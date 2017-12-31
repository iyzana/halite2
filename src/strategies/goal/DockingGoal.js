const Simulation = require('../Simulation');
const Geometry = require("../../hlt/Geometry");
const constants = require("../../hlt/Constants");
const ActionDock = require("../ActionDock");
const ActionThrust = require("../ActionThrust");
const GoalIntent = require('./GoalIntent');
const dockingStatus = require('../../hlt/DockingStatus');
const {findPath} = require("../LineNavigation");

class DockingGoal {
    constructor(gameMap, planet) {
        this.planet = planet;
    }

    shipRequests(gameMap) {
        const turnsTillNextShip = Simulation.turnsTillNextShip(this.planet);

        return gameMap.myShips
            .filter(ship => ship.isUndocked())
            .filter(ship => this.reachedBefore(ship, turnsTillNextShip - 2))
            .filter(ship => DockingGoal.producedBeforeAttacked(ship, gameMap))
            .map(ship => {
                const score = 1 - Geometry.distance(ship, this.planet) / gameMap.maxDistance;
                return new GoalIntent(ship, this, score);
            });
    }

    reachedBefore(ship, limit) {
        return Simulation.turnsTillEntityReached(ship, this.planet) < limit;
    }

    static producedBeforeAttacked(ship, gameMap) {
        return Simulation.nearestEntity(gameMap.enemyShips, ship).dist > 15;
    }

    effectivenessPerShip(gameMap, shipSet) {
        return this.planet.freeDockingSpots;
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