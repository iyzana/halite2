const log = require('../../hlt/Log');
const ActionThrust = require("../ActionThrust");
const ActionDock = require("../ActionDock");
const GoalIntent = require('./GoalIntent');
const Geometry = require('../../hlt/Geometry');
const constants = require('../../hlt/Constants');
const Simulation = require("../Simulation");
const {findPath} = require("../LineNavigation");

const defenseBalanceFactor = 1.3;

class DefenseGoal {
    constructor(gameMap, planet) {
        this.planet = planet;
    }

    shipRequests(gameMap) {
        const enemysEnemyPlanets = gameMap.playerIds
            .filter(id => id !== gameMap.myPlayerId)
            .map(id => [id, gameMap.planets.filter(p => p.isOwned() && p.ownerId !== id)])
            .toMap();

        log.log("enemyPlanets");
        enemysEnemyPlanets.forEach((planets, id) => {
            log.log("enemy " + id + " enemyPlanets: " + planets);
        });

        const attackingEnemies = gameMap.enemyShips
            .filter(enemy => enemy.isUndocked())
            .filter(enemy => this.isAttackingPlanet(gameMap, enemy))
            .filter(enemy => gameMap.planetsBetween(enemy, this.planet).length === 0)
            .filter(enemy => this.isClosestPlanetForEnemy(enemy, enemysEnemyPlanets.get(enemy.ownerId)));

        const attackedShipDistances = new Map(this.planet.dockedShips
            .map(ship => [ship.id, Simulation.nearestEntity(attackingEnemies, ship).dist]));

        const attackedShips = this.planet.dockedShips
            .sort((a, b) => attackedShipDistances.get(a.id) - attackedShipDistances.get(b.id));

        // no enemy attacking
        if (attackingEnemies.length === 0) {
            return [];
        }

        this.endangeredShip = attackedShips[0];
        this.enemyDistance = attackedShipDistances.get(this.endangeredShip.id);
        this.enemyCount = attackingEnemies.length;
        const turnsTillArrival = this.enemyDistance / constants.MAX_SPEED;

        log.log(this.planet + " attacked by " + this.enemyCount + " enemies");
        log.log("defending " + this.endangeredShip + " enemy distance is " + this.enemyDistance + " arrival in " + turnsTillArrival + " turns");

        let shipsStillNeeded = this.enemyCount;

        this.producedShips = Simulation.shipsInTurns(this.planet, turnsTillArrival - 1);
        const undockingShips = this.planet.dockedShips.filter(ship => ship.isUndocking());

        log.log(this.producedShips + " ships will be produced");
        log.log(undockingShips.length + " ships are undocking");

        shipsStillNeeded -= this.producedShips * defenseBalanceFactor;
        shipsStillNeeded -= undockingShips.length * defenseBalanceFactor;

        log.log(shipsStillNeeded + " ships still needed");

        // enough ships are produced to defeat all enemies
        if (shipsStillNeeded <= 0) {
            return [];
        }

        // find friendly ships that could defend
        const sortedShipsInRange = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .map(ship => ({ship, dist: Geometry.distance(ship, this.endangeredShip)}))
            .filter(tuple => tuple.dist < this.enemyDistance + constants.MAX_SPEED * 2);

        log.log("ships in range: " + sortedShipsInRange.map(tuple => tuple.ship));

        shipsStillNeeded -= sortedShipsInRange.length * defenseBalanceFactor;

        log.log(shipsStillNeeded + " ships still needed");

        let requiredShips = [];

        const shipsToUndock = attackedShips.filter(ship => ship.isDocked())
            .map(ship => new GoalIntent(ship, this, 1));
        requiredShips = requiredShips.concat(shipsToUndock);

        if (sortedShipsInRange.length > 0 && this.enemyDistance < 18) {
            const shipsToSend = sortedShipsInRange.map(tuple => {
                const score = 1 - tuple.dist / gameMap.maxDistance;
                return new GoalIntent(tuple.ship, this, score);
            });

            requiredShips = requiredShips.concat(shipsToSend);
        }

        return requiredShips;
    }

    isAttackingPlanet(gameMap, ship) {
        const previousShip = gameMap.previous.shipById(ship.id);
        if (!previousShip)
            return false;

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
    }

    isClosestPlanetForEnemy(enemy, enemyPlanets) {
        const otherPlanets = enemyPlanets.filter(p => p.id !== this.planet.id);
        const nearest = Simulation.nearestEntity(otherPlanets, enemy);
        return Geometry.distance(this.planet, enemy) < nearest.dist * 1.6;
    }

    effectivenessPerShip(gameMap, shipSet) {
        return 1; // Math.ceil(this.enemyCount / defenseBalanceFactor);
    }

    getShipCommands(gameMap, ships) {
        const attackedShips = this.planet.dockedShips;

        const nearShips = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .filter(ship => Geometry.distance(ship, this.endangeredShip) < this.enemyDistance + 4);

        const shipsInRange = ships.filter(s => s.isUndocked());
        const undockingShips = this.planet.dockedShips.filter(ship => ship.isUndocking());

        const shipsStillNeeded = this.enemyCount - (shipsInRange.length + undockingShips.length + nearShips + this.producedShips) * defenseBalanceFactor;

        let shipsToUndock = [];
        if (shipsStillNeeded > 0 && attackedShips.filter(ship => ship.isDocked()).length > this.producedShips) {
            shipsToUndock = attackedShips.filter(ship => ship.isDocked())
                .slice(0, shipsStillNeeded + this.producedShips * defenseBalanceFactor);

            log.log("undocking " + shipsToUndock.length + " ships");

        }

        return [...shipsInRange, ...shipsToUndock].map(ship => {
            if (ship.isDocked()) {
                return new ActionDock(ship, this.planet, false);
            } else {
                return DefenseGoal.navigateDefense(gameMap, ship, this.endangeredShip);
            }
        })
    }

    static navigateDefense(gameMap, ship, endangered) {
        const end = Geometry.reduceEnd(ship, endangered, constants.SHIP_RADIUS * 2.2);
        const {speed, angle} = findPath(gameMap, ship, end);
        return new ActionThrust(ship, speed, angle);
    }

    calculateGoalScore(gameMap) {
        this.score = 1.2;
    }

    toString() {
        return "defend->" + this.planet;
    }
}

module.exports = DefenseGoal;
