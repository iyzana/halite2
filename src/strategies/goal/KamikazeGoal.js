const log = require('../../hlt/Log');
const ActionThrust = require("../ActionThrust");
const Geometry = require("../../hlt/Geometry");
const constants = require("../../hlt/Constants");
const GoalIntent = require('./GoalIntent');

class KamikazeGoal {
    constructor(gameMap, ship) {
        this.ship = ship;
    }

    shipRequests(gameMap) {
        const damageReceiving = gameMap.enemyShips
            .filter(enemy => enemy.isUndocked())
            .filter(enemy => Geometry.distance(enemy, this.ship) < constants.WEAPON_RADIUS + constants.SHIP_RADIUS * 2 - 0.001)
            .map(enemy => this.damageDone(gameMap, enemy))
            .reduce((acc, cur) => acc + cur, 0);

        if (damageReceiving < this.ship.health && this.ship.health < 2 * damageReceiving) {
            log.log(this.ship + " kamikaze dmg receiving " + damageReceiving + " at health " + this.ship.health);

            const targets = gameMap.enemyShips
                .filter(e => !e.isUndocked())
                .filter(e => Geometry.distance(e, this.ship) < constants.MAX_SPEED + constants.SHIP_RADIUS * 2 - 0.001)
                .sort((a, b) => b.health - a.health);

            if (targets.length === 0 || targets[0].health < 64)
                return [];

            this.target = targets[0];

            if (gameMap.planetsBetween(this.ship, this.target))
                return [];

            log.log(this);

            return [new GoalIntent(this.ship, this, 1)];
        }
        return [];
    }

    damageDone(gameMap, enemy) {
        const damageSplitBetween = gameMap.allShips
            .filter(ship => ship.ownerId !== enemy.ownerId)
            .filter(ship => Geometry.distance(enemy, ship) < constants.EFFECTIVE_ATTACK_RADIUS)
            .length;

        return constants.WEAPON_DAMAGE / damageSplitBetween;
    }

    effectivenessPerShip(shipSet) {
        return 1;
    }

    getShipCommands(gameMap, ships) {
        const angle = Geometry.angleInDegree(this.ship, this.target);
        const speed = Math.min(7, Geometry.distance(this.ship, this.target) + 1);

        return new ActionThrust(this.ship, speed, angle);
    }

    calculateGoalScore(gameMap) {
        this.score = 1.9;
    }

    toString() {
        return "kamikaze " + this.ship + " -> " + this.target;
    }
}

module.exports = KamikazeGoal;