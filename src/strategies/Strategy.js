const log = require('../hlt/Log');

const Geometry = require('../hlt/Geometry');
const constants = require('../hlt/Constants');
const {spread, weightPlanets} = require('./Spread');
const {attack} = require('./Attack');
const ShipActions = require('./ShipActions');

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

    const possibleActions = gameMap.myShips
        .filter(s => s.isUndocked())
        .map(ship => {
            const actions = [...attack(ship, gameMap), ...spread(gameMap, planetsOfInterest, ship, planetWeights)];

            actions.sort((a, b) => b.score - a.score);

            return new ShipActions(ship, actions);
        });

    // tuple<ship, [action<score, name, data>]>
    planetsOfInterest.forEach(planet => {
        // search ships most fitting for populating planet
        let candidateShips = possibleActions
            .map(shipActions => [shipActions.actions.findIndex(action => action.data === planet), shipActions])
            .filter(tuple => tuple[0] !== -1);
        candidateShips.sort((a, b) => b[1].actions[b[0]].score - a[1].actions[a[0]].score);

        // remove go to planet action from other ships
        candidateShips
            .slice(planet.freeDockingSpots)
            .forEach(tuple => tuple[1].actions.splice(tuple[0], 1));
    });

    const moves = possibleActions
        .map(shipActions => {
            const ship = shipActions.ship;
            const action = shipActions.actions[0];

            log.log(ship + ': ' + shipActions.actions.slice(0, Math.min(shipActions.actions.length, 3)));

            return [ship, ...action.getAction(gameMap, ship)];
        });

    const thrusts = moves.filter(([ship, move]) => move === "thrust");
    thrusts.forEach(thrust1 => {
        const [ship1, move1, speed1, angle1] = thrust1;

        const similarThrusts = thrusts.filter(([ship2, move2]) => Geometry.distance(ship1, ship2) <= constants.MAX_SPEED)
            .filter(([ship2, move2, speed2, angle2]) => {
                const betweenShipsAngle = Geometry.angleInDegree(ship1, ship2);
                const thrustShipAngle = Geometry.angleBetween(angle1, betweenShipsAngle);
                const thrustAngle = Geometry.angleBetween(angle1, angle2);
                // check if thrustShipAngle and thrustAngle have the same sign
                return Math.abs(thrustAngle) < 5 && thrustShipAngle * thrustAngle > 0;
            });

        similarThrusts.push(thrust1);
        const avgAngle = similarThrusts
            .map(thrust => thrust[3])
            .reduce((prev, cur) => prev + cur, 0) / similarThrusts.length;

        similarThrusts.forEach(thrust => thrust[3] = avgAngle);
    });

    return moves.map(([ship, move, data1, data2]) => {
        log.log([ship, move, data1, data2]);
        switch (move) {
            case "thrust":
                lastThrustActions.set(ship.id, {
                    x: Math.floor(data1) * Math.cos(Geometry.toRad(Math.floor(data2))),
                    y: Math.floor(data1) * Math.sin(Geometry.toRad(Math.floor(data2))),
                });

                return ship.thrust(data1, data2);
            case "dock":
                return ship.dock(data1);
        }
    });
}

module.exports = {strategy};