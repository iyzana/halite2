const log = require('../hlt/Log');

const ActionThrust = require('./ActionThrust');
const {getActions} = require('./goal/Goal');
const {alignSimilarAngles, resolveDestinationConflicts, resolveCollisions} = require("./CollisionAvoidance");

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

    postprocessActions(actions);

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
}

function postprocessActions(actions) {
    const thrusts = actions.filter(action => action instanceof ActionThrust);

    thrusts.forEach(thrust => {
        log.log("1 thrust " + thrust.ship + " => >" + thrust.speed + " ø" + thrust.angle)
    });

    for (let i = 0; i < 3; i++) {
        thrusts.forEach(current => {
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
