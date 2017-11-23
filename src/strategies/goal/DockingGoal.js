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
        const sortedPlanets = gameMap.planets.sort((a, b) => a.radius - b.radius);
        const smallestPlanet = sortedPlanets[0];
        const biggestPlanet = sortedPlanets[sortedPlanets.length - 1];
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
                const radiusScore = (this.planet.radius - smallestPlanet.radius) / (biggestPlanet.radius - smallestPlanet.radius);
                const densityScore = 0;
                return new GoalIntent(ship, this, distanceScore);
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