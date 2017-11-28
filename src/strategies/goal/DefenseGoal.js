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
            .filter(ship => ship.isUndocked())
            .filter(ship => {
                const previousShip = gameMap.previous.shipById(ship.id);
                if (!previousShip) return false;

                const length = 100;

                const end = {
                    x: ship.x + (ship.x - previousShip.x) * length,
                    y: ship.y + (ship.y - previousShip.y) * length,
                };

                //ship is flying in the direction of our planet
                return Geometry.intersectSegmentCircle(ship, end, this.planet, this.planet.radius + Constants.DOCK_RADIUS);
            })
            .filter(ship => gameMap.obstaclesBetween(ship, this.planet).length === 0)
            .map(ship =>
                this.planet.dockedShips
                    .map(docked => [docked, Geometry.distance(docked, ship)]
                        .sort((a, b) => a[1] - b[1]))
                    [0]
            )
            .sort((a, b) => a[1] - b[1]);

        //No defense needed
        if (distances.length === 0) {
            return [];
        }

        this.endangeredShip = distances[0][0];
        const distance = distances[0][1];
        const turnsTillArrival = distance / Constants.MAX_SPEED;

        if (Simulation.turnsTillNextShip(this.planet) < turnsTillArrival) {
            return [];
        }

        const sortedShipsInRange = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .map(ship => [ship, Geometry.distance(ship, this.endangeredShip)])
            .filter(tuple => tuple[1] < distance + 20)
            .sort((a, b) => b[1] - a[1]);

        if (sortedShipsInRange.length === 0) {
            if (!this.planet.dockedShips.some(ship => ship.isUndocking())) {
                const intents = [new GoalIntent(this.endangeredShip, this, 1)];
                if (turnsTillArrival < Constants.DOCK_TURNS &&
                    this.planet.dockedShips.length > 1) {

                    const ship = this.planet.dockedShips
                        .filter(ship => ship !== this.endangeredShip)[0];

                    intents.push(new GoalIntent(ship, this, 1));
                }
                return intents;
            }

            return [];
        }


        const maxDistance = sortedShipsInRange[0][1];

        return sortedShipsInRange.map(tuple => {
            const score = 1 - tuple[1] / maxDistance;
            return new GoalIntent(tuple[0], this, score);
        });
    }

    effectivenessPerShip(gameMap, shipSet) {
        return 2;
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