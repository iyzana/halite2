class AttackGoal {
    constructor(enemy) {
        this.enemy = enemy;
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
        return "attack->" + this.enemy;
    }
}

module.exports = AttackGoal;