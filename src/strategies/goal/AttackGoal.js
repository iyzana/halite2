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
            .filter(enemy => enemy.isUndocked())
            .filter(enemy => Geometry.distance(this.enemy, enemy) < 8);

        return Math.ceil(enemies.length * 2);
    }

    getShipCommands(gameMap, ships) {
        const enemies = gameMap.enemyShips
            .filter(enemy => enemy.isUndocked())
            .filter(enemy => Geometry.distance(this.enemy, enemy) < 8);

        const closestShip = Simulation.nearestEntity(ships, this.enemy).entity;

        const ourBunch = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .filter(ship => Geometry.distance(closestShip, ship) < 8);

        if (ourBunch.length * 1.2 < enemies.length) {
            const ourPos = Geometry.averagePos(ships);
            const theirPos = Geometry.averagePos(enemies);

            //only running away when close
            if (Geometry.distance(closestShip, theirPos) < constants.MAX_SPEED * 2 + constants.WEAPON_RADIUS + constants.SHIP_RADIUS * 2) {
                const vector = Geometry.normalizeVector({
                    x: closestShip.x - theirPos.x,
                    y: closestShip.y - theirPos.y,
                });

                const escapePadding = gameMap.numberOfPlayers === 2 ? 1 : 3;
                const escapeDistance = constants.MAX_SPEED + constants.WEAPON_RADIUS + constants.SHIP_RADIUS * 2 + escapePadding;
                const retreatPoint = {
                    x: theirPos.x + vector.x * escapeDistance,
                    y: theirPos.y + vector.y * escapeDistance,
                };

                log.log('running away with ships: ' + ships);

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
        const to = Geometry.reduceEnd(ship, enemy, constants.WEAPON_RADIUS + constants.SHIP_RADIUS * 2 - 1);
        const {speed, angle} = findPath(gameMap, ship, to);
        return new ActionThrust(ship, speed, angle);
    }

    static navigateRetreat(gameMap, ship, enemy) {
        const to = Geometry.reduceEnd(ship, enemy, 0.5);
        const {speed, angle} = findPath(gameMap, ship, to);
        return new ActionThrust(ship, speed, angle);
    }
}

module.exports = AttackGoal;