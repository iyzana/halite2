const log = require('../../hlt/Log');
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
        const myPlanets = gameMap.planets
            .filter(planet => planet.isOwnedByMe());

        const attackingEnemies = gameMap.enemyShips
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
                return Geometry.intersectSegmentCircle(ship, end, this.planet, constants.DOCK_RADIUS + constants.SHIP_RADIUS + constants.EFFECTIVE_ATTACK_RADIUS);
            })
            .filter(ship => gameMap.planetsBetween(ship, this.planet).length === 0)
            .filter(enemy => Geometry.distance(this.planet, enemy) < Simulation.nearestEntity(myPlanets, enemy).dist * 2);

        const attackedShipDistances = new Map(this.planet.dockedShips
            .map(ship => [ship.id, Simulation.nearestEntity(attackingEnemies, ship).dist]));

        const attackedShips = this.planet.dockedShips
            .sort((a, b) => attackedShipDistances.get(a.id) - attackedShipDistances.get(b.id));

        // no enemy attacking
        if (attackingEnemies.length === 0) {
            return [];
        }

        this.endangeredShip = attackedShips[0];
        const enemyDistance = attackedShipDistances.get(this.endangeredShip.id);
        const enemyCount = attackingEnemies.length;
        const turnsTillArrival = enemyDistance / constants.MAX_SPEED;

        log.log(this.planet + " attacked by " + enemyCount + " enemies");
        log.log("defending " + this.endangeredShip + " enemy distance is " + enemyDistance + " arrival in " + turnsTillArrival + " turns");

        let shipsStillNeeded = enemyCount;

        const producedShips = Simulation.shipsInTurns(this.planet, turnsTillArrival);
        const undockingShips = this.planet.dockedShips.filter(ship => ship.isUndocking());

        log.log(producedShips + " ships will be produced");
        log.log(undockingShips.length + " ships are undocking");

        shipsStillNeeded -= producedShips;
        shipsStillNeeded -= undockingShips.length;

        log.log(shipsStillNeeded + " ships still needed");

        // enough ships are produced to defeat all enemies
        if (shipsStillNeeded <= 0) {
            return [];
        }

        // find friendly ships that could defend
        const sortedShipsInRange = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .map(ship => ({ship, dist: Geometry.distance(ship, this.endangeredShip)}))
            .filter(tuple => tuple.dist < enemyDistance + 15)
            .sort((a, b) => b.dist - a.dist);

        log.log("ships in range: " + sortedShipsInRange.map(tuple => tuple.ship));

        shipsStillNeeded -= sortedShipsInRange.length;

        log.log(shipsStillNeeded + " ships still needed");

        let requiredShips = [];

        if (shipsStillNeeded > 0) {
            const shipsToUndock = attackedShips.filter(ship => ship.isDocked())
                .slice(0, shipsStillNeeded)
                .map(ship => new GoalIntent(ship, this, 1));

            log.log("undocking " + shipsToUndock.length + " ships");

            requiredShips = requiredShips.concat(shipsToUndock);
        }

        if (sortedShipsInRange.length > 0 && enemyDistance < 15) {
            const maxDistance = sortedShipsInRange[0].dist;
            const shipsToSend = sortedShipsInRange.map(tuple => {
                const score = 1 - tuple.dist / maxDistance;
                return new GoalIntent(tuple.ship, this, score);
            });

            requiredShips = requiredShips.concat(shipsToSend);
        }

        return requiredShips;
    }

    effectivenessPerShip(gameMap, shipSet) {
        return 2;
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