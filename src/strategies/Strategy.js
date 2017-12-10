const log = require('../hlt/Log');
const Geometry = require('../hlt/Geometry');

const ActionThrust = require('./ActionThrust');
const {getActions} = require('./goal/Goal');
const {resolveWallCollisions, alignSimilarAngles, resolveDestinationConflicts, resolveCollisions} = require("./CollisionAvoidance");

require('./ArrayHelper');

let previousGameMap;

/**
 * Find the actions best suited for the state of the map
 *
 * @param gameMap The gameMap to process
 * @returns {Array} Array of action strings
 */
function strategy(gameMap) {
    preprocessMap(gameMap);

    const actions = getActions(gameMap);

    postprocessActions(gameMap, actions);

    return actions.map(action => action.getCommand());
}

function preprocessMap(gameMap) {
    if (previousGameMap) {
        delete previousGameMap.previous;
        gameMap.previous = previousGameMap;
    } else {
        gameMap.previous = gameMap;
    }
    previousGameMap = gameMap;

    gameMap.maxDistance = Math.sqrt(Math.pow(gameMap.width, 2) + Math.pow(gameMap.height, 2));

    if (!gameMap.planetHeuristics || gameMap.planetHeuristics.planetsLength !== gameMap.planets.length)
        computePlanetHeuristics(gameMap);
}

function computePlanetHeuristics(gameMap) {
    gameMap.planetHeuristics = {planetsLength: gameMap.planets.length};

    const sortedPlanets = gameMap.planets.sort((a, b) => a.radius - b.radius);
    gameMap.planetHeuristics.smallestRadius = sortedPlanets[0].radius;
    gameMap.planetHeuristics.biggestRadius = sortedPlanets[sortedPlanets.length - 1].radius;

    const planetDistances = {};

    // could be sparse
    for (let planet of gameMap.planets) {
        planetDistances[planet.id] = {};
        planetDistances[planet.id].distanceTo = {};
    }

    //causes double computation but is more readable
    gameMap.planets.forEach(p1 => {
        gameMap.planets.forEach(p2 => {
            const distance = Geometry.distance(p1, p2);
            planetDistances[p1.id].distanceTo[p2.id] = distance;
            planetDistances[p2.id].distanceTo[p1.id] = distance;
        });
    });

    const enemyDistance = {
        average: [],
        biggest: -Infinity,
        smallest: Infinity
    };
    gameMap.planets.forEach(p => enemyDistance.average[p.id] = 0);

    const enemyPlanets = gameMap.planets.filter(p => p.isOwnedByEnemy());

    if (enemyPlanets.length > 0) {
        gameMap.planets
            .filter(p => !p.isOwnedByEnemy())
            .forEach(p1 => {
                enemyPlanets.forEach(p2 => {
                    enemyDistance.average[p1.id] += planetDistances[p1.id].distanceTo[p2.id];
                });
                enemyDistance.average[p1.id] /= enemyPlanets.length;
                if (enemyDistance.biggest < enemyDistance.average[p1.id]) {
                    enemyDistance.biggest = enemyDistance.average[p1.id];
                }

                if (enemyDistance.smallest > enemyDistance.average[p1.id]) {
                    enemyDistance.smallest = enemyDistance.average[p1.id];
                }
            });
    }

    gameMap.planetHeuristics.enemyDistance = enemyDistance;

    Object.values(planetDistances).forEach(planetDistance => {
        planetDistance.sum = Object.values(planetDistance.distanceTo).reduce((acc, cur) => acc + cur ** 2)
    });

    gameMap.planetHeuristics.planetDistances = planetDistances;

    gameMap.planetHeuristics.smallestDistances = Infinity;
    gameMap.planetHeuristics.biggestDistances = -Infinity;

    Object.values(planetDistances)
        .map(planetDistance => planetDistance.sum)
        .forEach(sum => {
            if (sum < gameMap.planetHeuristics.smallestDistances)
                gameMap.planetHeuristics.smallestDistances = sum;
            if (sum > gameMap.planetHeuristics.biggestDistances)
                gameMap.planetHeuristics.biggestDistances = sum;
        });
}

function postprocessActions(gameMap, actions) {
    const thrusts = actions.filter(action => action instanceof ActionThrust);

    thrusts.forEach(thrust => {
        log.log("1 thrust " + thrust.ship + " => >" + thrust.speed + " ø" + thrust.angle)
    });

    for (let i = 0; i < 5; i++) {
        thrusts.forEach(current => resolveWallCollisions(gameMap, current));

        thrusts.forEach(current => alignSimilarAngles(current, thrusts));

        thrusts.forEach(current => resolveDestinationConflicts(current, thrusts));

        thrusts.forEach(current => resolveCollisions(current, thrusts));
    }

    thrusts.forEach(thrust => {
        log.log("2 thrust " + thrust.ship + " => >" + thrust.speed + " ø" + thrust.angle)
    });
}

module.exports = {strategy};
