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
        const enemysEnemyPlanets = gameMap.playerIds
            .filter(id => id !== gameMap.myPlayerId)
            .reduce((acc, c) => (acc[c] = gameMap.planets.filter(p => p.ownerId !== c && p.isOwned())) && acc, {});

        log.log("enemyPlanets");
	Object.keys(enemysEnemyPlanets).forEach(id => {
	    log.log("enemy " + id + " enemyPlanets: " + enemysEnemyPlanets[id]);
	});

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
                const onItsWay = Geometry.intersectSegmentCircle(ship, end, this.planet, constants.DOCK_RADIUS + constants.SHIP_RADIUS);
                const aroundHere = Geometry.distance(ship, this.planet) < this.planet.radius + constants.DOCK_RADIUS + constants.NEXT_TICK_ATTACK_RADIUS;

                return onItsWay || aroundHere;
            })
            .filter(ship => gameMap.planetsBetween(ship, this.planet).length === 0)
            .filter(enemy => {
                const otherPlanets = enemysEnemyPlanets[enemy.ownerId].filter(p => p.id !== this.planet.id);
                const nearest = Simulation.nearestEntity(otherPlanets, enemy);
                return Geometry.distance(this.planet, enemy) < nearest.dist * 1.6;
            });

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
        this.enemyCount = attackingEnemies.length;
        const turnsTillArrival = enemyDistance / constants.MAX_SPEED;

        log.log(this.planet + " attacked by " + this.enemyCount + " enemies");
        log.log("defending " + this.endangeredShip + " enemy distance is " + enemyDistance + " arrival in " + turnsTillArrival + " turns");

        let shipsStillNeeded = this.enemyCount;

        const producedShips = Simulation.shipsInTurns(this.planet, turnsTillArrival - 1);
        const undockingShips = this.planet.dockedShips.filter(ship => ship.isUndocking());

        log.log(producedShips + " ships will be produced");
        log.log(undockingShips.length + " ships are undocking");

        shipsStillNeeded -= producedShips * 1.3;
        shipsStillNeeded -= undockingShips.length * 1.3;

        log.log(shipsStillNeeded + " ships still needed");

        // enough ships are produced to defeat all enemies
        if (shipsStillNeeded <= 0) {
            return [];
        }

        // find friendly ships that could defend
        const sortedShipsInRange = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .map(ship => ({ship, dist: Geometry.distance(ship, this.endangeredShip)}))
            .filter(tuple => tuple.dist < enemyDistance + constants.MAX_SPEED * 2)
            .sort((a, b) => b.dist - a.dist);

        log.log("ships in range: " + sortedShipsInRange.map(tuple => tuple.ship));

        shipsStillNeeded -= sortedShipsInRange.length * 1.3;

        log.log(shipsStillNeeded + " ships still needed");

        let requiredShips = [];

        if (shipsStillNeeded > 0) {
            const shipsToUndock = attackedShips.filter(ship => ship.isDocked())
                .slice(0, shipsStillNeeded + producedShips * 1.3)
                .map(ship => new GoalIntent(ship, this, 1));

            log.log("undocking " + shipsToUndock.length + " ships");

            requiredShips = requiredShips.concat(shipsToUndock);
        }

        if (sortedShipsInRange.length > 0 && enemyDistance < 21) {
            const shipsToSend = sortedShipsInRange.map(tuple => {
                const score = 1 - tuple.dist / gameMap.maxDistance;
                return new GoalIntent(tuple.ship, this, score);
            });

            requiredShips = requiredShips.concat(shipsToSend);
        }

        return requiredShips;
    }

    effectivenessPerShip(gameMap, shipSet) {
        return Math.ceil(this.enemyCount / 1.3);
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
