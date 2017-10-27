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

        thrusts
            .filter(([ship2]) => ship1 !== ship2)
            .filter(([ship2, move2]) => Geometry.distance(ship1, ship2) <= constants.MAX_SPEED * 2)
            .filter(([ship2, move2, speed2, angle2]) => {
                const newX1 = ship1.x + Math.floor(speed1) * Math.cos(Geometry.toRad(Math.floor(angle1)));
                const newY1 = ship1.y + Math.floor(speed1) * Math.sin(Geometry.toRad(Math.floor(angle1)));
                const newX2 = ship2.x + Math.floor(speed2) * Math.cos(Geometry.toRad(Math.floor(angle2)));
                const newY2 = ship2.y + Math.floor(speed2) * Math.sin(Geometry.toRad(Math.floor(angle2)));


                return Geometry.distance({x: newX1, y: newY1}, {x: newX2, y:newY2}) < constants.SHIP_RADIUS;
            })
            .forEach(thrust => {
                thrust[2] = Math.max(0, thrust[2] - 3.5);
            });
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