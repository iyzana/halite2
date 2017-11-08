class Goal {
    constructor() {

    }

    shipRequests(gameMap) {
        //returns [[prio, ship], ...]
    }

    getShipCommands(ships) {
        //returns [command, ...]
    }

    effectivenessPerShip(numOrShipSet) {
        //returns effectiveness value
    }
}

function identifyGoals(gameMap) {
    const planetGoals = gameMap.planets.map(planet => {
        if(planet.isOwnedByMe()) {
            if(planet.freeDockingSpots > 0) {
                // new DockingGoal
            }

            // new DefenseGoal
        } else if(planet.isFree()) {
            // new DockingGoal
        }
    });

    const attackGoals = gameMap.enemyShips.map(ship => {
        // new AttackGoal
    });

    return [...planetGoals, ...attackGoals];
}

module.exports = Goal;