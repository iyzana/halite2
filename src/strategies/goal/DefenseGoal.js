const ActionThrust = require("../ActionThrust");
const ActionDock = require("../ActionDock");
const GoalIntent = require('./GoalIntent');
const Geometry = require('../../hlt/Geometry');
const Constants = require('../../hlt/Constants');
const Simulation = require("../Simulation");
const {findPath} = require("../LineNavigation");

class DefenseGoal {
    constructor(gameMap, planet) {
        this.planet = planet;
    }

    shipRequests(gameMap) {

        const distances = gameMap.enemyShips
            .filter(ship => {
               const previousShip = gameMap.previous.shipById(ship.id);
               const length = 100;

               const end = {
                   x: ship.x + (ship.x - previousShip.x) * length,
                   y: ship.y + (ship.y - previousShip.y) * length,
               };

               //ship is flying in the direction of our planet
               return Geometry.intersectSegmentCircle(ship, end, this.planet, Constants.DOCK_RADIUS);
            })
            .filter(ship => gameMap.obstaclesBetween(ship, this.planet) > 0)
            .map(ship =>
                    this.planet.dockedShips
                        .map(docked => [docked, Geometry.distance(docked, ship)]
                        .sort((a, b) => b[1] - a[1]))
                )
            .sort((a, b) => b[1] - a[1]);

        this.endangeredShip = distances[0][0];
        const distance = distances[0][1];
        const turnsTillArrival = distance / Constants.MAX_SPEED;

        const sortedShipsInRange = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .map(ship => [ship, Geometry.distance(ship, this.endangeredShip)])
            .filter(tuple => tuple[1] < distance)
            .sort((a, b) => a[1] - b[1]);

        if (sortedShipsInRange.length === 0 &&
            !this.planet.dockedShips.some(ship => ship.isUndocking()) &&
            Simulation.turnsTillNextShip(this.planet) < turnsTillArrival) {

            const intents = [new GoalIntent(this.endangeredShip, this, 1)];
            if (turnsTillArrival < Constants.DOCK_TURNS) {
                if (this.planet.dockedShips.length > 1) {
                    const ship = this.planet.dockedShips
                        .filter(ship => ship !== this.endangeredShip)[0];

                    intents.push(new GoalIntent(ship, this, 1));
                }
            }
            return intents;
        }

        const maxDistance = sortedShipsInRange[0][1];

        return sortedShipsInRange.map(tuple => {
            const score = 1 - tuple[1] / maxDistance;
            return new GoalIntent(tuple[0], this, score);
        });
    }

    effectivenessPerShip(shipSet) {
        return 1;
    }

    getShipCommands(gameMap, ships) {
        return ships.map(ship => {
            if(ship.isDocked())
                return new ActionDock(ship, this.planet, false);

            return DefenseGoal.navigateDefense(gameMap, ship, this.endangeredShip);
        })
    }

    toString() {
        return "defend->" + this.planet;
    }

    static navigateDefense(gameMap, ship, endangered) {
        const end = Geometry.reduceEnd(ship, endangered, Constants.SHIP_RADIUS*2.2);
        const {speed, angle} = findPath(gameMap, ship, end);
        return new ActionThrust(ship, speed, angle);
    }
}

module.exports = DefenseGoal;