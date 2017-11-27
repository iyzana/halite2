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

    if(!gameMap.planetHeuristics || gameMap.planetHeuristics.planetsLength !== gameMap.planets.length)
        computePlanetHeuristics(gameMap);
}

function computePlanetHeuristics(gameMap) {
    gameMap.planetHeuristics = {planetsLength: gameMap.planets.length};

    const sortedPlanets = gameMap.planets.sort((a, b) => a.radius - b.radius);
    gameMap.planetHeuristics.smallestRadius = sortedPlanets[0].radius;
    gameMap.planetHeuristics.biggestRadius = sortedPlanets[sortedPlanets.length - 1].radius;

    const planetDistances = [];

    for(let i = 0; i < gameMap.planets.length; i++)
        planetDistances.push([]);

    //causes double computation but is more readable
    gameMap.planets.forEach(p1 => {
        gameMap.planets.forEach(p2 => {
            const distance = Geometry.distance(p1, p2);
            planetDistances[p1.id][p2.id] = distance;
            planetDistances[p2.id][p1.id] = distance;
        });
    });

    planetDistances.forEach(planetDistance => {
        planetDistance.sum = planetDistance.reduce((acc, cur) => acc + cur ** 2)
    });

    const sortedPlanetDistances = planetDistances.sort((a, b) => a.sum - b.sum);

    gameMap.planetHeuristics.planetDistances = planetDistances;
    gameMap.planetHeuristics.smallestDistances = sortedPlanetDistances[0].sum;
    gameMap.planetHeuristics.biggestDistances = sortedPlanetDistances[sortedPlanetDistances.length - 1].sum;
}

function postprocessActions(gameMap, actions) {
    const thrusts = actions.filter(action => action instanceof ActionThrust);

    thrusts.forEach(thrust => {
        log.log("1 thrust " + thrust.ship + " => >" + thrust.speed + " ø" + thrust.angle)
    });

    for (let i = 0; i < 3; i++) {
        thrusts.forEach(current => {
            resolveWallCollisions(gameMap, current);

            alignSimilarAngles(current, thrusts);

            resolveDestinationConflicts(current, thrusts);

            resolveCollisions(current, thrusts);
        });
    }

    thrusts.forEach(thrust => {
        log.log("2 thrust " + thrust.ship + " => >" + thrust.speed + " ø" + thrust.angle)
    });
}

module.exports = {strategy};
