const ActionThrust = require("../ActionThrust");
const ActionDock = require("../ActionDock");
const GoalIntent = require('./GoalIntent');
const Geometry = require('../../hlt/Geometry');
const constants = require('../../hlt/Constants');
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

                const vector = Geometry.normalizeVector({
                    x: ship.x - previousShip.x,
                    y: ship.y - previousShip.y,
                });
                const end = {
                    x: ship.x + vector.x * 50,
                    y: ship.y + vector.y * 50,
                };

                // ship is flying in the direction of our planet
                return Geometry.intersectSegmentCircle(ship, end, this.planet, constants.DOCK_RADIUS + constants.SHIP_RADIUS);
            })
            .filter(ship => gameMap.planetsBetween(ship, this.planet).length === 0)
            .map(ship => Simulation.nearestEntity(this.planet.dockedShips, ship))
            .sort((a, b) => a.dist - b.dist);

        // no enemy attacking
        if (distances.length === 0) {
            return [];
        }

        this.endangeredShip = distances[0].entity;
        const enemyDistance = distances[0].dist;
        const enemyCount = distances.length;
        const turnsTillArrival = enemyDistance / constants.MAX_SPEED;

        // enough ships are produced to defeat all enemies
        if (Simulation.shipsInTurns(turnsTillArrival) >= enemyCount) {
            return [];
        }

        // find friendly ships that could defend
        const sortedShipsInRange = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .map(ship => [ship, Geometry.distance(ship, this.endangeredShip)])
            .filter(tuple => tuple[1] < enemyDistance + 15)
            .sort((a, b) => b[1] - a[1]);

        if (sortedShipsInRange.length < enemyCount) {
            const remainingRequires = enemyCount - sortedShipsInRange.length;

            if (!this.planet.dockedShips.some(ship => ship.isUndocking())) {
                const intents = [new GoalIntent(this.endangeredShip, this, 1)];
                if (turnsTillArrival < constants.DOCK_TURNS &&
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

    effectivenessPerShip(shipSet) {
        return 1;
    }

    getShipCommands(gameMap, ships) {
        return ships.map(ship => {
            if (ship.isDocked())
                return new ActionDock(ship, this.planet, false);

            return DefenseGoal.navigateDefense(gameMap, ship, this.endangeredShip);
        })
    }

    toString() {
        return "defend->" + this.planet;
    }

    static navigateDefense(gameMap, ship, endangered) {
        const end = Geometry.reduceEnd(ship, endangered, constants.SHIP_RADIUS * 2.2);
        const {speed, angle} = findPath(gameMap, ship, end);
        return new ActionThrust(ship, speed, angle);
    }
}

module.exports = DefenseGoal;