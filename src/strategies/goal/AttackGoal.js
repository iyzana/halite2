const log = require('../../hlt/Log');
const ActionThrust = require("../ActionThrust");
const Geometry = require("../../hlt/Geometry");
const Simulation = require("../Simulation");
const constants = require("../../hlt/Constants");
const GoalIntent = require('./GoalIntent');
const {findPath} = require("../LineNavigation");

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
            .map(ship => {
                let score = 1 - Geometry.distance(ship, this.enemy) / gameMap.maxDistance;
                return new GoalIntent(ship, this, score);
            })
    }

    effectivenessPerShip(gameMap, shipSet) {
        const enemies = gameMap.enemyShips
            .filter(enemy => Geometry.distance(this.enemy, enemy) < constants.EFFECTIVE_ATTACK_RADIUS + 4);

        return Math.ceil(enemies.length * 1.2);
    }

    getShipCommands(gameMap, ships) {
        const enemies = gameMap.enemyShips
            .filter(enemy => enemy.isUndocked())
            .filter(enemy => Geometry.distance(this.enemy, enemy) < constants.EFFECTIVE_ATTACK_RADIUS + 4);

        const closestShip = Simulation.nearestEntity(ships, this.enemy).entity;

        const ourBunch = gameMap.myShips
        // .filter(ship => ship.isUndocked())
            .filter(ship => Geometry.distance(closestShip, ship) < constants.EFFECTIVE_ATTACK_RADIUS + 4);

        if (ourBunch.length <= enemies.length) {
            const theirClosestShip = Simulation.nearestEntity(enemies, closestShip).entity;
            const vector = Geometry.normalizeVector({
                x: closestShip.x - theirClosestShip.x,
                y: closestShip.y - theirClosestShip.y,
            });

            const escapePadding = gameMap.numberOfPlayers === 2 ? 1 : 3;
            const escapeDistance = constants.NEXT_TICK_ATTACK_RADIUS + escapePadding;
            const retreatPoint = {
                x: theirClosestShip.x + vector.x * escapeDistance,
                y: theirClosestShip.y + vector.y * escapeDistance,
            };

            log.log('running away with ships: ' + ships);

            const obstacles = gameMap.enemyShips.map(enemy => ({x: enemy.x, y: enemy.y, radius: constants.NEXT_TICK_ATTACK_RADIUS}));

            return ships.map(ship => {
                return AttackGoal.navigateRetreat(gameMap, ship, retreatPoint, obstacles);
            });
        }

        return AttackGoal.navigateAttack(gameMap, ships, this.enemy);
    }

    toString() {
        return "attack->" + this.enemy;
    }

    static navigateAttack(gameMap, ships, enemy) {
        const attackDistance = enemy.isUndocked() ? 0 : constants.WEAPON_RADIUS + constants.SHIP_RADIUS * 2 - 1;
        const tuples = ships.map(ship => {
            const to = Geometry.reduceEnd(ship, enemy, attackDistance);
            const turns = Math.floor(Simulation.turnsTillPositionReached(ship, to));
            return {ship, to, turns};
        });
        const turns = tuples[0].turns;

        if (tuples.every(t => t.turns === turns)) {
            //every ship can reach the enemy in the same number of turns so we attack
            return tuples.map(t => {
                const {speed, angle} = findPath(gameMap, t.ship, t.to);
                return new ActionThrust(t.ship, speed, angle);
            });
        } else {
            log.log("attack->" + enemy);
            log.log("grouping with ships: " +  ships);
            //we should group first
            const groupingPoint = Geometry.averagePos(ships);
            return ships.map(ship => {
                const to = Geometry.reduceEnd(ship, groupingPoint, constants.SHIP_RADIUS);
                const {speed, angle} = findPath(gameMap, ship, to);
                return new ActionThrust(ship, speed, angle);
            });
        }
    }

    static navigateRetreat(gameMap, ship, retreatPoint, obstacles) {
        const to = Geometry.reduceEnd(ship, retreatPoint, 0.5);
        const {speed, angle} = findPath(gameMap, ship, to, to, 0, obstacles);
        return new ActionThrust(ship, speed, angle);
    }
}

module.exports = AttackGoal;