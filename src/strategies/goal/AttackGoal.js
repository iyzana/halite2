const log = require('../../hlt/Log');
const ActionThrust = require("../ActionThrust");
const Geometry = require("../../hlt/Geometry");
const Simulation = require("../Simulation");
const constants = require("../../hlt/Constants");
const GoalIntent = require('./GoalIntent');
const {findPath} = require("../LineNavigation");

const GROUPING_RADIUS = constants.EFFECTIVE_ATTACK_RADIUS + 4;

class AttackGoal {
    constructor(gameMap, enemy) {
        this.enemy = enemy;

        if (this.enemy.isDocked()) {
            this.dockedAt = Simulation.nearestEntity(gameMap.planets, this.enemy).entity;
            this.nextShip = Simulation.turnsTillNextShip(this.dockedAt);
        }
    }

    shipRequests(gameMap) {
        return gameMap.myShips
            .filter(ship => ship.isUndocked())
            .map(ship => new GoalIntent(ship, this, 1 - Geometry.distance(ship, this.enemy) / gameMap.maxDistance));
    }

    effectivenessPerShip(gameMap, shipSet) {
        const enemies = gameMap.enemyShips
            .filter(enemy => Geometry.distance(this.enemy, enemy) < GROUPING_RADIUS);

        if (enemies.length === 1)
            return 1;
        return Math.ceil(enemies.length * 1.2);
    }

    getShipCommands(gameMap, ships, grantedShips) {
        //if we attack a docked enemy it is not in the list(potential empty list)
        //this is intentional
        const enemies = gameMap.enemyShips
            .filter(enemy => enemy.isUndocked())
            .filter(enemy => Geometry.distance(this.enemy, enemy) < GROUPING_RADIUS);

        const closestShip = Simulation.nearestEntity(ships, this.enemy).entity;

        const ourBunch = enemies
            .concat(this.enemy.isUndocked() ? [] : [this.enemy])
            .flatMap(e => {
                const grantedShip = grantedShips.find(({goal}) => goal instanceof AttackGoal && goal.enemy === e);
                if (grantedShip) {
                    return grantedShip.ships;
                }
                return [];
            })
            .filter(ship => Geometry.distance(closestShip, ship) < GROUPING_RADIUS);

        const ourHealth = ourBunch.reduce((acc, c) => acc + c.health, 0);
        const enemyHealth = enemies.reduce((acc, c) => acc + c.health, 0);

        const lessShips = ourBunch.length < enemies.length;
        const lessHealth = ourHealth <= enemyHealth && ourBunch.length === enemies.length;
        if (lessShips || lessHealth) {
            const theirClosestShip = Simulation.nearestEntity(enemies, closestShip).entity;

            // only running away when close
            if (Geometry.distance(closestShip, theirClosestShip) < constants.MAX_SPEED + constants.NEXT_TICK_ATTACK_RADIUS) {
                const vector = Geometry.normalizeVector({
                    x: closestShip.x - theirClosestShip.x,
                    y: closestShip.y - theirClosestShip.y,
                });

                const escapePadding = gameMap.numberOfPlayers === 2 ? 1 : 3;
                const escapeDistance = constants.NEXT_TICK_ATTACK_RADIUS + constants.SHIP_RADIUS + escapePadding;
                const retreatPoint = {
                    x: theirClosestShip.x + vector.x * escapeDistance,
                    y: theirClosestShip.y + vector.y * escapeDistance,
                };

                log.log('running away with ships: ' + ships);

                let obstacles = gameMap.enemyShips
                    .filter(ship => ship.isUndocked())
                    .map(enemy => ({x: enemy.x, y: enemy.y, radius: constants.NEXT_TICK_ATTACK_RADIUS}));

                if(ships.length !== 1)
                    obstacles = [];

                return ships.map(ship => AttackGoal.navigateRetreat(gameMap, ship, retreatPoint, obstacles));
            }
        }

        return ships.map(ship => AttackGoal.navigateAttack(gameMap, ship, this.enemy));
    }

    toString() {
        return "attack->" + this.enemy;
    }

    static navigateAttack(gameMap, ship, enemy) {
        const attackDistance = enemy.isUndocked() ? 0 : constants.EFFECTIVE_ATTACK_RADIUS - 1;
        const to = Geometry.reduceEnd(ship, enemy, attackDistance);
        const {speed, angle} = findPath(gameMap, ship, to);
        return new ActionThrust(ship, speed, angle);
    }

    static navigateRetreat(gameMap, ship, retreatPoint, obstacles) {
        const to = Geometry.reduceEnd(ship, retreatPoint, 0.5);
        const {speed, angle} = findPath(gameMap, ship, to, obstacles);
        return new ActionThrust(ship, speed, angle);
    }

    calculateGoalScore(gameMap) {
        const myPlanets = gameMap.planets.filter(planet => planet.isOwnedByMe());

        const distanceToPlanet = Simulation.nearestEntity(gameMap.planets, this.enemy).dist;

        // todo: try scoring by distance from enemy to closest of our planets
        if (this.enemy.isUndocked()) {
            this.score = 1.02;
        } else if (this.enemy.isUndocking()) {
            this.score = 1.045;
        } else {
            this.score = 1.04;
            const distanceToMe = Simulation.nearestEntity(myPlanets, this.enemy).dist;
            if (distanceToMe > 60) {
                this.score += 0.04;
            }
        }

        if (distanceToPlanet > 60) {
            this.score -= 2;
        }
    }
}

module.exports = AttackGoal;