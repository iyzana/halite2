class DefenseGoal {
    constructor(planet) {
        this.planet = planet;
    }

    shipRequests(gameMap) {
        return gameMap.myShips.map(ship => {
            return {score: 0, ship, goal: this};
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