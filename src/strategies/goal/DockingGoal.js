const Simulation = require('../Simulation');
const Geometry = require("../../hlt/Geometry");
const constants = require("../../hlt/Constants");
const ActionDock = require("../ActionDock");
const ActionThrust = require("../ActionThrust");
const GoalIntent = require('./GoalIntent');
const {findPath} = require("../LineNavigation");

class DockingGoal {
    constructor(gameMap, planet) {
        this.planet = planet;
    }

    shipRequests(gameMap) {
        const turnsTillNewShip = Simulation.turnsTillNextShip(this.planet);

        return gameMap.myShips
            .filter(ship => ship.isUndocked())
            .sort((ship1, ship2) => Geometry.distance(ship1, ship2))
            .map(ship => {
                const turnsTillEntityReached = Simulation.turnsTillEntityReached(ship, this.planet);

                if (turnsTillEntityReached >= turnsTillNewShip) {
                    return new GoalIntent(ship, this, 0);
                }

                const distanceScore = 1 - Geometry.distance(ship, this.planet) / gameMap.maxDistance;
                const radiusScore = (this.planet.radius - gameMap.planetHeuristics.smallestRadius) / (gameMap.planetHeuristics.biggestRadius - gameMap.planetHeuristics.smallestRadius);
                const densityScore = 1 - (gameMap.planetHeuristics.planetDistances[this.planet.id].sum - gameMap.planetHeuristics.smallestDistances) / (gameMap.planetHeuristics.biggestDistances - gameMap.planetHeuristics.smallestDistances);

                const distanceWeight = 1;
                const radiusWeight = 1;
                const densityWeight = 1;

                const score = (distanceWeight * distanceScore + radiusWeight * radiusScore + densityWeight * densityScore) / (distanceWeight + radiusWeight + densityWeight);

                return new GoalIntent(ship, this, score);
            });
    }

    effectivenessPerShip(shipSet) {
        return 1;
    }

    getShipCommands(gameMap, ships) {
        return ships.map(ship => {
            if (ship.canDock(this.planet)) {
                return new ActionDock(ship, this.planet, true);
            } else {
                return DockingGoal.navigatePlanet(gameMap, ship, this.planet);
            }
        });
    }

    toString() {
        return "dock->" + this.planet;
    }

    static navigatePlanet(gameMap, ship, planet) {
        const to = Geometry.reduceEnd(ship, planet, planet.radius + constants.SHIP_RADIUS + 0.05);
        const {speed, angle} = findPath(gameMap, ship, to);
        return new ActionThrust(ship, speed, angle);
    }
}

module.exports = DockingGoal;