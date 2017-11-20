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
        return ships.map(ship => {
            return AttackGoal.navigateAttack(gameMap, ship, this.enemy);
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