const log = require('../hlt/Log');

const Geometry = require('../hlt/Geometry');
const Simulation = require('./Simulation');
const constants = require('../hlt/Constants');
const {spread, weightPlanets} = require('./Spread');
const {attack} = require('./Attack');
const ShipIntents = require('./ShipIntents');

Array.prototype.toString = function () {
    return "[" + this.join(", ") + "]";
};

const lastThrustActions = new Map();

function strategy(gameMap) {
    gameMap.myShips
        .filter(s => lastThrustActions.has(s.id))
        .forEach(ship => {
            ship._params.x = ship.x + lastThrustActions.get(ship.id).x;
            ship._params.y = ship.y + lastThrustActions.get(ship.id).y;
        });

    lastThrustActions.clear();

    const planetWeights = weightPlanets(gameMap);

    const planetsOfInterest = gameMap.planets.filter(p => p.isFree() || (p.isOwnedByMe() && p.hasDockingSpot()));

    log.log("planets: " + planetsOfInterest);

    const possibleIntents = gameMap.myShips
        .filter(s => s.isUndocked())
        .map(ship => {
            const intents = [...attack(ship, gameMap), ...spread(gameMap, planetsOfInterest, ship, planetWeights)];

            intents.sort((a, b) => b.score - a.score);

            return new ShipIntents(ship, intents);
        });

    planetsOfInterest.forEach(planet => {
        // search ships most fitting for populating planet
        let candidateShips = possibleIntents
            .map(shipIntents => [shipIntents.intents.findIndex(intent => intent.data === planet), shipIntents])
            .filter(tuple => tuple[0] !== -1);
        candidateShips.sort((a, b) => b[1].intents[b[0]].score - a[1].intents[a[0]].score);

        // remove go to planet intent from other ships
        candidateShips
            .slice(planet.freeDockingSpots)
            .forEach(tuple => tuple[1].intents.splice(tuple[0], 1));
    });

    const moves = possibleIntents
        .map(shipIntents => {
            const ship = shipIntents.ship;
            const intent = shipIntents.intents[0];

            log.log(ship + ': ' + shipIntents.intents.slice(0, Math.min(shipIntents.intents.length, 3)));

            return [ship, ...intent.getAction(gameMap, ship)];
        });

    const thrusts = moves.filter(([ship, move]) => move === "thrust");
    thrusts.forEach(current => {
        alignSimilarAngles(current, thrusts);

        resolveDestinationConflicts(current, thrusts);
    });

    return moves.map(([ship, move, data1, data2]) => {
        log.log([ship, move, data1, data2]);
        switch (move) {
            case "thrust":
                lastThrustActions.set(ship.id, Simulation.toVector(data1, data2));

                return ship.thrust(data1, data2);
            case "dock":
                return ship.dock(data1);
        }
    });
}

function alignSimilarAngles(current, thrusts) {
    const ship1 = current[0];

    const similarThrusts = thrusts.filter(([ship2, move2]) => Geometry.distance(ship1, ship2) <= constants.MAX_SPEED)
        .filter(([ship2, move2, speed2, angle2]) => {
            const betweenShipsAngle = Geometry.angleInDegree(ship1, ship2);
            const thrustShipAngle = Geometry.angleBetween(current[3], betweenShipsAngle);
            const thrustAngle = Geometry.angleBetween(current[3], angle2);
            // check if thrustShipAngle and thrustAngle have the same sign
            return Math.abs(thrustAngle) < 5 && thrustShipAngle * thrustAngle >= 0;
        });

    const avgDifference =
        similarThrusts
            .map(thrust => Geometry.angleBetween(current[3], thrust[3])) // make relative to current to avoid 1, 359 issue
            .reduce((prev, cur) => prev + cur, 0) / similarThrusts.length;
    const avgAngle = current[3] + avgDifference;

    similarThrusts.forEach(thrust => thrust[3] = avgAngle);
}

function resolveDestinationConflicts(current, thrusts) {
    const ship1 = current[0];

    thrusts
        .filter(([ship2]) => ship1 !== ship2)
        .filter(([ship2, move2]) => Geometry.distance(ship1, ship2) <= constants.MAX_SPEED * 2)
        .filter(([ship2, move2, speed2, angle2]) => {
            let next1 = Simulation.positionNextTick(ship1, current[2], current[3]);
            let next2 = Simulation.positionNextTick(ship2, speed2, angle2);
            return Geometry.distance(next1, next2) <= constants.SHIP_RADIUS * 2.2;
        })
        .forEach(thrust => {
            thrust[2] = Math.max(0, thrust[2] - 3.5);
        });
}

module.exports = {strategy};
