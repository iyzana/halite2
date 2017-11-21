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
                const maxDistance = Math.sqrt(Math.pow(gameMap.width, 2) + Math.pow(gameMap.height, 2));

                let score = 1 - Geometry.distance(ship, this.enemy) / maxDistance;
                return new GoalIntent(ship, this, score);
            })
    }

    effectivenessPerShip(shipSet) {
        return 1;
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
            if(Geometry.distance(closestShip, theirPos) < 16) {
                const vector = {
                    x: closestShip.x - theirPos.x,
                    y: closestShip.y - theirPos.y,
                };

                const length = Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
                vector.x /= length;
                vector.y /= length;

                const retreatPoint = {
                    x: closestShip.x + vector.x * 15,
                    y: closestShip.y + vector.y * 15,
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