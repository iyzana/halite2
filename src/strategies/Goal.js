const Simulation = require('./Simulation');
const Geometry = require("../hlt/Geometry");

class Goal {
    constructor(shipRequests, getShipCommands, effectivenessPerShip) {
        this.shipRequests = shipRequests;
        this.getShipCommands = getShipCommands;
        this.effectivenessPerShip = effectivenessPerShip;
    }

    shipRequests(gameMap) {
        //returns [{score, ship, goal}, ...]
    }

    getShipCommands(ships) {
        //returns [command, ...]
    }

    effectivenessPerShip(numOrShipSet) {
        //returns effectiveness value
    }
}

class DockingGoal {
    constructor(planet) {
        this.planet = planet;
    }

    shipRequests(gameMap) {
        const turnsTillNewShip = Simulation.turnsTillNextShip(this.planet);

        gameMap.myShips
            .sort((ship1, ship2) => Geometry.distance(ship1, ship2))
            .map(ship => {
                const turnsTillEntityReached = Simulation.turnsTillEntityReached(ship, planet);
                if(turnsTillNewShip < turnsTillEntityReached) {
                    return { score: 0, ship, goal:this };
                }
        })
    }

    getShipCommands(ships) {

    }

    effectivenessPerShip(shipSet) {

    }
}


class DefenseGoal {
    constructor(planet) {

    }

    shipRequests(gameMap) {

    }

    getShipCommands(ships) {

    }

    effectivenessPerShip(shipSet) {

    }
}

class AttackGoal {
    constructor(ship) {

    }

    shipRequests(gameMap) {

    }

    getShipCommands(ships) {

    }

    effectivenessPerShip(shipSet) {

    }
}

function identifyGoals(gameMap) {
    const planetGoals = gameMap.planets
        .filter(planet => (planet.isOwnedByMe() && planet.freeDockingSpots > 0) || planet.isFree())
        .map(planet => new DockingGoal(planet));

    const defenseGoals = gameMap.planets
        .filter(planet => planet.isOwnedByMe())
        .map(planet => new DefenseGoal(planet));

    const attackGoals = gameMap.enemyShips.map(ship => new AttackGoal(ship));

    return [...planetGoals, ...defenseGoals, ...attackGoals];
}

function rateGoals(goals) {
    goals.forEach(goal => goal.score = 1.0);
    return goals;
}

Array.prototype.flatMap = function(lambda) {
    return Array.prototype.concat.apply([], this.map(lambda));
};

Array.prototype.groupBy = function(keyFunction) {
    var groups = {};
    this.forEach(function(el) {
        var key = keyFunction(el);
        if (key in groups == false) {
            groups[key] = [];
        }
        groups[key].push(el);
    });
    return Object.keys(groups).map(function(key) {
        return {
            key: key,
            values: groups[key]
        };
    });
};



function calcShipRequests(gameMap, goals) {
    return goals
        .flatMap(goal => goal.shipRequests(gameMap))
        .groupBy(shipRequest => shipRequest.ship)
        .map(entry => new Intent(entry.key, entry.values));
}

function magicLoop(Intents) {
    // TODO: do magic stuff to assign ships to goals
}


module.exports = Goal;