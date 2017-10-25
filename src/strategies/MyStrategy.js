const log = require('../hlt/Log');

const {spread, weightPlanets} = require('./Spread');
const {attack} = require('./Attack');
const ShipActions = require('./ShipActions');

Array.prototype.toString = function () {
    return "[" + this.join(", ") + "]";
};

function strategy(gameMap) {
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

    return possibleActions
        .map(shipActions => {
            const ship = shipActions.ship;
            const action = shipActions.actions[0];

            log.log(ship + ': ' + shipActions.actions.slice(0, Math.min(shipActions.actions.length, 3)));

            return action.execute(ship);
        });
}

module.exports = {strategy};