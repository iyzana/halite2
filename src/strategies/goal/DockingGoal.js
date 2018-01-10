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
        const reachedBeforeUndockRadius = this.planet.radius + constants.DOCK_RADIUS + constants.DOCK_TURNS * 2 * constants.MAX_SPEED;
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
        const dockableShipCount = Math.max(0, myShipsInRange * 1.5 + producedShipsInRange - opponentShipsInRange);

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
        const to = Geometry.reduceEnd(ship, planet, planet.radius + constants.SHIP_RADIUS + 0.05);
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
            if (nearestOpponent < this.planet.radius + 22)
                this.score -= 0.03;
            else
                this.score += 0.025;

            // docking larger planets only lessens travel times so only value it a bit
            this.score += radiusScore * 0.002 - 0.001;
            this.score += densityScore * 0.02 - 0.01;

            // try not to dock near enemy planets to avoid early fighting
            this.score += enemyScore * 0.02 - 0.01;
            /*
            prefer emptier planets
            this is useful for sending a few ship to planets that are a bit farther away
            this way the planet sits on its own till it's full and then returns ships many turns later
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