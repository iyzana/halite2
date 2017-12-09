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

        return Math.ceil(enemies.length * 2);
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
            const ourPos = Geometry.averagePos(ships);
            const theirPos = Geometry.averagePos(enemies);
            const theirClosestShip = Simulation.nearestEntity(enemies, closestShip).entity;

            //only running away when close
            if (Geometry.distance(closestShip, theirClosestShip) < constants.MAX_SPEED + constants.NEXT_TICK_ATTACK_RADIUS) {
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

                // const obstacles = gameMap.enemyShips.map(enemy => ({x: enemy.x, y: enemy.y, radius: constants.NEXT_TICK_ATTACK_RADIUS}));

                return ships.map(ship => {
                    return AttackGoal.navigateRetreat(gameMap, ship, retreatPoint);
                });
            }
        }

        return ships.map(ship => {
            return AttackGoal.navigateAttack(gameMap, ship, this.enemy);
        });
    }

    toString() {
        return "attack->" + this.enemy;
    }

    static navigateAttack(gameMap, ship, enemy) {
        const to = this.getAttackPos(enemy, gameMap, ship);
        const {speed, angle} = findPath(gameMap, ship, to);
        return new ActionThrust(ship, speed, angle);
    }

    // implicit dependency on HarassmentGoal.getAttackPos
    static getAttackPos(enemy, gameMap, ship) {
        const attackBuffer = enemy.isUndocked() ? 2 : 1;
        const attackDistance = constants.WEAPON_RADIUS + constants.SHIP_RADIUS * 2 - attackBuffer;

        const nearEnemies = gameMap.enemyShips
            .filter(nearEnemy => Geometry.distance(enemy, nearEnemy) < constants.EFFECTIVE_ATTACK_RADIUS)
            .filter(nearEnemy => nearEnemy.id !== enemy.id);

        let to;
        if (nearEnemies.length === 0) {
            to = Geometry.reduceEnd(ship, enemy, attackDistance);
        } else {
            const awayVector = nearEnemies
                .map(nearEnemy => ({x: nearEnemy.x - enemy.x, y: nearEnemy.y - enemy.y}))
                .reduce((acc, c) => ({x: acc.x += c.x, y: acc.y + c.y}), {x: 0, y: 0});

            const normalized = Geometry.normalizeVector(awayVector);

            to = {
                x: enemy.x - normalized.x * attackDistance,
                y: enemy.y - normalized.y * attackDistance
            }
        }

        return to;
    }

    static navigateRetreat(gameMap, ship, enemy) {
        const to = Geometry.reduceEnd(ship, enemy, 0.5);
        const {speed, angle} = findPath(gameMap, ship, to);
        return new ActionThrust(ship, speed, angle);
    }
}

module.exports = AttackGoal;