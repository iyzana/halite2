const ActionThrust = require("../ActionThrust");
const GoalIntent = require('./GoalIntent');

class DefenseGoal {
    constructor(gameMap, planet) {
        this.planet = planet;
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
        return "defend->" + this.planet;
    }
}

module.exports = DefenseGoal;