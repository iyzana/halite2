const log = require('../hlt/Log');

const Geometry = require('../hlt/Geometry');
const Simulation = require('./Simulation');
const constants = require('../hlt/Constants');
const ActionThrust = require('./ActionThrust');
const {getActions} = require('./goal/Goal');

require('./ArrayHelper');

let previousGameMap;

/**
 * Find the actions best suited for the state of the map
 *
 * @param gameMap The gameMap to process
 * @returns {Array} Array of action strings
 */
function strategy(gameMap) {
    // const planetWeights = weightPlanets(gameMap);
    //
    // const planetsOfInterest = gameMap.planets.filter(p => p.isFree() || (p.isOwnedByMe() && p.hasDockingSpot()));
    //
    // log.log("planets: " + planetsOfInterest);
    //
    // const possibleIntents = gameMap.myShips
    //     .filter(s => s.isUndocked())
    //     .map(ship => {
    //         const intents = [...attack(ship, gameMap), ...spread(gameMap, planetsOfInterest, ship, planetWeights)];
    //
    //         intents.sort((a, b) => b.score - a.score);
    //
    //         return new ShipIntents(ship, intents);
    //     });
    //
    // planetsOfInterest.forEach(planet => {
    //     // search ships most fitting for populating planet
    //     let candidateShips = possibleIntents
    //         .map(shipIntents => [shipIntents.intents.findIndex(intent => intent.data === planet), shipIntents])
    //         .filter(tuple => tuple[0] !== -1);
    //     candidateShips.sort((a, b) => b[1].intents[b[0]].score - a[1].intents[a[0]].score);
    //
    //     // remove planet intent from other ships
    //     candidateShips
    //         .slice(planet.freeDockingSpots)
    //         .forEach(tuple => tuple[1].intents.splice(tuple[0], 1));
    // });
    //
    // // actually makes stuff slightly worse, needs improvement
    // // distributeAttacks(gameMap, possibleIntents);
    //
    // const actions = possibleIntents
    //     .map(shipIntents => {
    //         const ship = shipIntents.ship;
    //         const intent = shipIntents.intents[0];
    //
    //         log.log(ship + ': ' + shipIntents.intents.slice(0, Math.min(shipIntents.intents.length, 3)));
    //
    //         return intent.getAction(gameMap, ship);
    //     });

    if (previousGameMap) {
        gameMap.previous = previousGameMap;
    } else {
        gameMap.previous = gameMap;
    }
    previousGameMap = gameMap;

    const actions = getActions(gameMap);

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

    return actions.map(action => action.getCommand());
}

/**
 * Post-processes the intents so that the number of ships attacking
 * a particular entity at once is minimized and the attacks are spread.
 *
 * @param gameMap The gameMap to process
 * @param possibleIntents The list of intents to post-process
 */
function distributeAttacks(gameMap, possibleIntents) {
    // create loose hitmap
    const w = Math.ceil(gameMap.width / 5.0);
    const h = Math.ceil(gameMap.height / 5.0);
    const grid = new Array(w);
    for (let x = 0; x < w; x++) {
        grid[x] = new Array(h);
        for (let y = 0; y < h; y++) {
            grid[x][y] = [];
        }
    }

    // map attack intents to grid positions
    possibleIntents.forEach(shipIntent => {
        shipIntent.intents
            .filter(intent => intent.type === "attack")
            .forEach(intent => {
                grid[Math.trunc(intent.data.x / 5.0)][Math.trunc(intent.data.y / 5.0)].push([shipIntent.ship, intent]);
            })
    });

    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            // sort intents by distance ascending
            grid[x][y].sort((a, b) => Geometry.distance(a[0], a[1].data) - Geometry.distance(b[0], b[1].data));

            // except for the first two, decrease intent score
            grid[x][y]
                .slice(2)
                .forEach(([ship, intent]) => intent.score -= .5);
        }
    }

    // resort intents
    possibleIntents.forEach(shipIntent => {
        shipIntent.intents.sort((a, b) => b.score - a.score);
    });
}

/**
 * Find all thrusts that have a similar angle, but would intersect with the current thrust.
 * For these thrusts take the average angle and apply it to them.
 *
 * @param current Thrust intent to compare against
 * @param thrusts All thrust intents
 */
function alignSimilarAngles(current, thrusts) {
    // find all thrusts with similar angle
    const similarThrusts = thrusts.filter(thrust2 => Geometry.distance(current.ship, thrust2.ship) <= constants.MAX_SPEED)
        .filter(thrust2 => {
            const betweenShipsAngle = Geometry.angleInDegree(current.ship, thrust2.ship);
            const thrustShipAngle = Geometry.angleBetween(current.angle, betweenShipsAngle);
            const thrustAngle = Geometry.angleBetween(current.angle, thrust2.angle);
            // check if thrustShipAngle and thrustAngle have the same sign
            return Math.abs(thrustAngle) < 5 && thrustShipAngle * thrustAngle >= 0;
        });

    // calculate the average angle
    const avgDifference =
        similarThrusts
            .map(thrust2 => Geometry.angleBetween(current.angle, thrust2.angle)) // make relative to current to avoid 1, 359 issue
            .reduce((prev, cur) => prev + cur, 0) / similarThrusts.length;
    const avgAngle = (current.angle + avgDifference + 360) % 360;

    log.log("align angles " + similarThrusts.map(t => t.ship) + " to " + avgAngle);

    // apply it
    similarThrusts.forEach(thrust => thrust.angle = avgAngle);
}

/**
 * Reduce the speed of all thrusts, that would, in the next tick, end up in the same
 * location as the current thrust.
 *
 * @param current Thrust intent to compare against
 * @param thrusts All thrust intents
 */
function resolveDestinationConflicts(current, thrusts) {
    thrusts
        .filter(thrust2 => current.ship !== thrust2.ship)
        .filter(thrust2 => Geometry.distance(current.ship, thrust2.ship) <= constants.MAX_SPEED * 2 + constants.SHIP_RADIUS * 2)
        .filter(thrust2 => {
            let next1 = Simulation.positionNextTick(current.ship, current.speed, current.angle);
            let next2 = Simulation.positionNextTick(thrust2.ship, thrust2.speed, thrust2.angle);
            return Geometry.distance(next1, next2) <= constants.SHIP_RADIUS * 2.2;
        })
        .forEach(thrust2 => {
            thrust2.speed = Math.max(0, thrust2.speed - 3.5);
            log.log("throttling speed for " + thrust2.ship + " to " + thrust2.speed);
        });
}

function resolveCollisions(current, thrusts) {
    thrusts
        .filter(thrust2 => current.ship !== thrust2.ship)
        .filter(thrust2 => Geometry.distance(current.ship, thrust2.ship) <= constants.MAX_SPEED * 2)
        .forEach(thrust2 => {
            const t1 = Simulation.toVector(current.speed, current.angle);
            const t2 = Simulation.toVector(thrust2.speed, thrust2.angle);
            const {collision} = Simulation.collisionTime(constants.SHIP_RADIUS * 2, current.ship, thrust2.ship, t1, t2);

            if (collision) {
                log.log(`swapping: ${current.ship.id} <> ${thrust2.ship.id}`);
                t1.x += current.ship.x;
                t1.y += current.ship.y;

                t2.x += thrust2.ship.x;
                t2.y += thrust2.ship.y;

                const tmp = thrust2.ship;
                thrust2.ship = current.ship;
                thrust2.speed = Math.min(7, Geometry.distance(thrust2.ship, t2));
                thrust2.angle = Geometry.angleInDegree(thrust2.ship, t2);

                current.ship = tmp;
                current.speed = Math.min(7, Geometry.distance(current.ship, t1));
                current.angle = Geometry.angleInDegree(current.ship, t1);
            }

        })
}

module.exports = {strategy};
