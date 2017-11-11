const ActionThrust = require("../ActionThrust");
const GoalIntent = require('./GoalIntent');

class AttackGoal {
    constructor(enemy) {
        this.enemy = enemy;
    }

    shipRequests(gameMap) {
        return gameMap.myShips.map(ship => {
            return new GoalIntent(ship, this, 0);
        })
    }

    effectivenessPerShip(shipSet) {
        return 1;
    }

    getShipCommands(gameMap, ships) {
        return ships.map(ship => {
            return new ActionThrust(ship, 0, 0);
        })
    }

    toString() {
        return "attack->" + this.enemy;
    }
}

module.exports = AttackGoal;