const log = require("../../hlt/Log");
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
            .filter(ship => ship.isUndocked())
            .map(ship => new GoalIntent(ship, this, this.getShipScore(gameMap, ship, turnsTillNewShip)));
    }

    getShipScore(gameMap, ship, turnLimit) {
        const turnsTillEntityReached = Simulation.turnsTillEntityReached(ship, this.planet);

        if (turnsTillEntityReached >= turnLimit || Simulation.nearestEntity(gameMap.enemyShips, ship).dist < 15) {
            return 0;
        }

        return 1 - Geometry.distance(ship, this.planet) / gameMap.maxDistance;
    }

    effectivenessPerShip(gameMap, shipSet) {
        return this.planet.freeDockingSpots;
    }

    getShipCommands(gameMap, ships) {
        const reachedBeforeUndockRadius = this.planet.radius + constants.DOCK_RADIUS + (constants.DOCK_TURNS * 2 + 1) * constants.MAX_SPEED;
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

        // don't dock ships if an enemy could reach them before they're undocked again
        const dockableShipCount = Math.max(0, myShipsInRange * 1.3 + producedShipsInRange * 0.8 - opponentShipsInRange);

        const movement = ships
            .filter(s => !s.canDock(this.planet))
            .map(s => DockingGoal.navigatePlanet(gameMap, s, this.planet));

        const dockableShips = ships
            .filter(s => s.canDock(this.planet));
        const dockMoves = dockableShips
            .slice(0, dockableShipCount)
            .map(s => new ActionDock(s, this.planet, true));
        const stillMoves = dockableShips
            .slice(dockableShipCount, dockableShips.length)
            .map(s => new ActionThrust(s, 0, 0));

        return [...movement, ...dockMoves, ...stillMoves];
        // return ships.map(ship => {
        //     if (ship.canDock(this.planet)) {
        //         return new ActionDock(ship, this.planet, true);
        //     } else {
        //         return DockingGoal.navigatePlanet(gameMap, ship, this.planet);
        //     }
        // });
    }

    static navigatePlanet(gameMap, ship, planet) {
        let to;
        if (Geometry.distance(ship, planet) < planet.radius + constants.DOCK_RADIUS + constants.MAX_SPEED + ship.radius) {
            // move to the planets spawn point in the last turn before being able to dock
            const spawnPoint = planet.calcShipSpawnPoint();

            if (spawnPoint !== null) {
                const spawnAngle = Geometry.angleInDegree(ship, spawnPoint);

                const planetCircle = {
                    x: planet.x,
                    y: planet.y,
                    radius: planet.radius + constants.DOCK_RADIUS,
                };

                const shipCircle = {
                    x: ship.x,
                    y: ship.y,
                    radius: ship.radius + constants.MAX_SPEED,
                };

                const intersections = Geometry.intersectCircles(planetCircle, shipCircle);
                const angles = intersections.map(i => Geometry.angleInDegree(ship, i));

                if (Geometry.angleInRange(spawnAngle, angles[0], angles[1])) {
                    to = spawnPoint;
                } else if (Math.abs(Geometry.angleBetween(angles[0], spawnAngle)) < Math.abs(Geometry.angleBetween(angles[1], spawnAngle))) {
                    to = intersections[0];
                } else {
                    to = intersections[1];
                }
            } else {
                to = Geometry.reduceEnd(ship, planet, planet.radius + constants.SHIP_RADIUS + 0.05);
            }
        } else {
            to = Geometry.reduceEnd(ship, planet, planet.radius + constants.SHIP_RADIUS + 0.05);
        }
        const {speed, angle} = findPath(gameMap, ship, to);
        return new ActionThrust(ship, speed, angle);
    }

    toString() {
        return "dock->" + this.planet;
    }

    calculateGoalScore(gameMap) {
        this.score = 0.98;

        const distance = Geometry.distance(this.planet, {x: gameMap.width / 2, y: gameMap.height / 2});

        const heuristic = gameMap.planetHeuristics;
        const radiusDifference = (heuristic.biggestRadius - heuristic.smallestRadius) || heuristic.smallestRadius;
        const radiusScore = (this.planet.radius - heuristic.smallestRadius) / radiusDifference;

        const distanceDifference = (heuristic.biggestDistances - heuristic.smallestDistances) || heuristic.smallestDistances;
        const densityScore = (heuristic.planetDistances[this.planet.id].sum - heuristic.smallestDistances) / distanceDifference;

        const enemyDifference = (heuristic.enemyDistance.biggest - heuristic.enemyDistance.smallest) || heuristic.enemyDistance.smallest;
        const enemyScore = ((heuristic.enemyDistance.average[this.planet.id] - heuristic.enemyDistance.smallest) / enemyDifference);

        // if in early game on 4 player map
        if (gameMap.numberOfPlayers === 4 && gameMap.populatedPlanetsPct <= 0.6) {
            // docking is more important on 4 player maps
            this.score += 0.01;

            // docking further out is good on 4 player maps
            this.score += distance / (gameMap.maxDistance / 2) * 0.1 - 0.05;

            const nearestOpponent = Simulation.nearestEntity(gameMap.enemyShips, this.planet).dist;
            if (nearestOpponent < this.planet.radius + 22) {
                this.score -= 0.025;
                if (nearestOpponent < this.planet.radius + 11)
                    this.score -= 0.015;
            } else {
                this.score += 0.025;
            }

            // docking larger planets only lessens travel times so only value it a bit
            this.score += radiusScore * 0.002 - 0.001;
            this.score += densityScore * 0.02 - 0.01;

            // try not to dock near enemy planets to avoid early fighting
            this.score += enemyScore * 0.02 - 0.01;
            /*
            prefer emptier planets
            this is useful for sending a few ship to planets that are a bit farther away
            we are basically planting a 'seed' on the planet and get the reward later in the game
             */
            this.score += this.planet.freeDockingSpots / 6 * 0.1 - 0.05;
        } else if (gameMap.numberOfPlayers === 2) {
            const nearestOpponent = Simulation.nearestEntity(gameMap.enemyShips, this.planet).dist;
            if (nearestOpponent < this.planet.radius + 22)
                this.score -= 0.03;
            else
                this.score += 0.025;
            this.score += this.planet.freeDockingSpots / 6 * 0.2 - 0.1;
            this.score -= densityScore * 0.01 - 0.005;
        }
    }
}

module.exports = DockingGoal;