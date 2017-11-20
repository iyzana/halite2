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

        let attackPoint = this.enemy;

        const enemies = gameMap.enemyShips
            .filter(enemy => enemy.isUndocked())
            .filter(enemy => Geometry.distance(this.enemy, enemy) < constants.WEAPON_RADIUS);

        if (ships.length < enemies.length) {
            const ourPos = Geometry.averagePos(ships);
            const theirPos = Geometry.averagePos(enemies);

            //only running away when close
            if(Geometry.distance(ourPos, theirPos) < constants.WEAPON_RADIUS * 2) {
                const vector = {
                    x: ourPos.x - theirPos.x,
                    y: ourPos.y - theirPos.y,
                };

                const length = Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
                vector.x /= length;
                vector.y /= length;

                attackPoint = {
                    x: ourPos.x + vector.x * 15,
                    y: ourPos.y + vector.y * 15,
                };

                log.log('running away with ships: ' + ships);
            }
        }

        return ships.map(ship => {
            return AttackGoal.navigateAttack(gameMap, ship, attackPoint);
        })
    }

    toString() {
        return "attack->" + this.enemy;
    }

    static navigateAttack(gameMap, ship, enemy) {
        const to = Geometry.reduceEnd(ship, enemy, constants.WEAPON_RADIUS - 1);
        const {speed, angle} = findPath(gameMap, ship, to);
        return new ActionThrust(ship, speed, angle);
    }
}

module.exports = AttackGoal;