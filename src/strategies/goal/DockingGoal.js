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
            .sort((ship1, ship2) => Geometry.distance(ship1, ship2))
            .map(ship => {
                const turnsTillEntityReached = Simulation.turnsTillEntityReached(ship, this.planet);

                if (turnsTillEntityReached >= turnsTillNewShip) {
                    return new GoalIntent(ship, this, 0);
                }

                // todo: put in global variable
                const maxDistance = Math.sqrt(Math.pow(gameMap.width, 2) + Math.pow(gameMap.height, 2));

                let score = 1 - Geometry.distance(ship, this.planet) / maxDistance;
                return new GoalIntent(ship, this, score);
            });
    }

    effectivenessPerShip(shipSet) {
        return 1;
    }

    getShipCommands(gameMap, ships) {
        return ships.map(ship => {
            if (ship.canDock(this.planet)) {
                return new ActionDock(ship, this.planet);
            } else {
                return DockingGoal.navigatePlanet(gameMap, ship, this.planet);
            }
        });
    }

    toString() {
        return "dock->" + this.planet;
    }

    static navigatePlanet(gameMap, ship, planet) {
        const to = Geometry.reduceEnd(ship, planet, planet.radius + constants.DOCK_RADIUS - 1);
        const {speed, angle} = findPath(gameMap, ship, to);
        return new ActionThrust(ship, speed, angle);
    }
}

module.exports = DockingGoal;