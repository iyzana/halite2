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

        const reachedBeforeUndockRadius = this.planet.radius + constants.DOCK_RADIUS + (constants.DOCK_TURNS + 1) * constants.MAX_SPEED;
        const myShipsInRange = gameMap.myShips
            .filter(s => s.isUndocked())
            .filter(s => Geometry.distance(s, this.planet) < reachedBeforeUndockRadius)
            .length;
        const producedShipsInRange = gameMap.planets
            .filter(p => p.isOwnedByMe())
            .filter(p => Geometry.distance(this.planet, p) < reachedBeforeUndockRadius)
            .map(p => Simulation.shipsInTurns(p, (reachedBeforeUndockRadius - Geometry.distance(p, this.planet) / 2) / constants.MAX_SPEED))
            .reduce((acc, c) => acc + c, 0);
        const opponentShipsInRange = gameMap.enemyShips
            .filter(s => s.isUndocked())
            .filter(s => Geometry.distance(s, this.planet) < reachedBeforeUndockRadius)
            .length;

        let attackingEnemies;
        if (myShipsInRange * 1.8 + producedShipsInRange < opponentShipsInRange) {
            attackingEnemies = gameMap.enemyShips
                .filter(enemy => enemy.isUndocked())
                .filter(enemy => Geometry.distance(enemy, this.planet) < reachedBeforeUndockRadius)
        } else {
            attackingEnemies = gameMap.enemyShips
                .filter(enemy => enemy.isUndocked())
                .filter(enemy => this.isAttackingPlanet(gameMap, enemy))
                .filter(enemy => gameMap.planetsBetween(enemy, this.planet).length === 0)
                .filter(enemy => this.isClosestPlanetForEnemy(enemy, enemysEnemyPlanets.get(enemy.ownerId)));
        }

        const attackedShipDistances = new Map(this.planet.dockedShips
            .map(ship => [ship.id, Simulation.nearestEntity(attackingEnemies, ship).dist]));

        const attackedShips = this.planet.dockedShips
            .sort((a, b) => attackedShipDistances.get(a.id) - attackedShipDistances.get(b.id));

        // no enemy attacking
        if (attackingEnemies.length === 0) {
            return [];
        }

        this.endangeredShip = attackedShips[0]; // docked ship closest to any attacker
        this.enemyDistance = attackedShipDistances.get(this.endangeredShip.id);
        this.enemyCount = attackingEnemies.length;
        const turnsTillArrival = this.enemyDistance / constants.MAX_SPEED;

        log.log(this.planet + " attacked by " + this.enemyCount + " enemies");
        log.log("defending " + this.endangeredShip + ": enemy distance is " + this.enemyDistance + " arrival in " + turnsTillArrival + " turns");

        this.producedShips = Simulation.shipsInTurns(this.planet, turnsTillArrival - 1);
        const undockingShips = this.planet.dockedShips.filter(ship => ship.isUndocking());

        log.log(this.producedShips + " ships will be produced");
        log.log(undockingShips.length + " ships are undocking");

        if (this.enemyCount <= (this.producedShips + undockingShips.length) * defenseBalanceFactor) {
            // enough ships are produced or undocking to defeat all enemies
            return [];
        }

        // find friendly ships that could defend
        const sortedShipsInRange = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .map(ship => ({ship, dist: Geometry.distance(ship, this.endangeredShip)}))
            .filter(tuple => tuple.dist < this.enemyDistance + constants.MAX_SPEED * 2);

        log.log("ships in range: " + sortedShipsInRange.map(tuple => tuple.ship));

        let requiredShips = [];

        // request all ships docked at this planet and decide how to use them later
        const dockedShips = attackedShips.filter(ship => ship.isDocked())
            .map(ship => new GoalIntent(ship, this, 1));
        requiredShips = requiredShips.concat(dockedShips);

        // only draw in friendly ships if the enemy is quite close
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
        const distance = Geometry.distance(ship, this.planet);

        // we could safely dock and undock, ignore ship
        const reachedBeforeUndockRadius = this.planet.radius + constants.DOCK_RADIUS + (constants.DOCK_TURNS * 2 + 1) * constants.MAX_SPEED;
        if (distance > reachedBeforeUndockRadius)
            return false;

        // ship could attack this turn
        const aroundHere = distance < this.planet.radius + constants.DOCK_RADIUS + constants.NEXT_TICK_ATTACK_RADIUS;
        if (aroundHere)
            return true;

        // get movement direction of enemy
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

        // ship is flying in the rough direction of the planet
        return Geometry.intersectSegmentCircle(ship, end, this.planet, constants.DOCK_RADIUS + constants.SHIP_RADIUS + 3);
    }

    isClosestPlanetForEnemy(enemy, enemyPlanets) {
        // check if planet is roughly the closest out of all planets which the attacker would consider enemies
        const otherPlanets = enemyPlanets.filter(p => p.id !== this.planet.id);
        const nearest = Simulation.nearestEntity(otherPlanets, enemy);
        return Geometry.distance(this.planet, enemy) < nearest.dist * 1.6;
    }

    effectivenessPerShip(gameMap, shipSet) {
        return Math.ceil(this.enemyCount / 4) + this.planet.dockedShips.length;
    }

    getShipCommands(gameMap, ships) {
        const attackedShips = this.planet.dockedShips;

        const nearShips = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .filter(ship => Geometry.distance(ship, this.endangeredShip) < this.enemyDistance + 4);

        const shipsInRange = ships.filter(s => s.isUndocked());
        const undockingShips = attackedShips.filter(ship => ship.isUndocking());

        const shipsStillNeeded = this.enemyCount - (shipsInRange.length + undockingShips.length + nearShips.length + this.producedShips) * defenseBalanceFactor;

        // we do not have enough ships in range for defense, undock so we have
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

    // swarm the attacked ship
    static navigateDefense(gameMap, ship, endangered) {
        const end = Geometry.reduceEnd(ship, endangered, constants.SHIP_RADIUS * 2.2);
        const {speed, angle} = findPath(gameMap, ship, end);
        return new ActionThrust(ship, speed, angle);
    }

    calculateGoalScore(gameMap) {
        this.score = 1.25;
    }

    toString() {
        return "defend->" + this.planet;
    }
}

module.exports = DefenseGoal;
