const constants = require('../hlt/Constants');
const Geometry = require('../hlt/Geometry');
const log = require('../hlt/Log');

let scaleTo;
let maxDistance;

Array.prototype.toString = function () {
    return "[" + this.join(", ") + "]";
};

function initialize(gameMap) {
    scaleTo = Math.sqrt(Math.floor(gameMap.width * gameMap.height));
    maxDistance = Math.sqrt(Math.pow(gameMap.width, 2) + Math.pow(gameMap.height, 2));
}

function weightPlanets(gameMap) {
    let planets = gameMap.planets;

    return new Map(planets.map(planet => {
        const weight = planets.map(planetWeigher(planet))
            .filter(v => v > 0)
            .reduce((prev, cur) => prev + cur, 0);

        return [planet, weight];
    }));
}

function planetWeigher(planet) {
    return neighbor => planet.dockingSpots * (1 - Geometry.distance(planet, neighbor) / scaleTo);
}

class Action {
    constructor(score, type, data) {
        this.score = score;
        this.type = type;
        this.data = data;
    }

    execute(ship) {
        if (this.type === "spread") {
            if (ship.canDock(this.data)) {
                return ship.dock(this.data);
            } else {
                return navigateTo(ship, this.data);
            }
        } else if (this.type === "attack") {
            return navigateAttack(ship, this.data);
        }
    }
}

class ShipActions {
    constructor(ship, actions) {
        this.ship = ship;
        this.actions = actions;
    }
}

function strategy(gameMap) {
    if (!maxDistance)
        initialize(gameMap);

    const planetWeights = weightPlanets(gameMap);

    const planetsOfInterest = gameMap.planets.filter(p => p.isFree() || (p.isOwnedByMe() && p.hasDockingSpot()));

    log.log("planets: " + planetsOfInterest);

    const possibleActions = gameMap.myShips
        .filter(s => s.isUndocked())
        .map(ship => {
            const actions = [...attack(ship, gameMap), ...spread(planetsOfInterest, ship, planetWeights)];

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

function navigateAttack(ship, attackPos) {
    const distance = Geometry.distance(ship, attackPos);
    const speed = distance < 30 ? constants.MAX_SPEED / 2 : constants.MAX_SPEED;
    return ship.navigate({
        target: attackPos,
        speed,
        avoidObstacles: true,
        ignoreShips: false
    })
}

function navigateTo(ship, planet) {
    const distance = Geometry.distance(ship, planet);
    const speed = distance < 30 ? constants.MAX_SPEED / 2 : constants.MAX_SPEED;
    return ship.navigate({
        target: planet,
        keepDistanceToTarget: planet.radius + constants.DOCK_RADIUS,
        speed,
        avoidObstacles: true,
        ignoreShips: false
    });
}

function spread(planetsOfInterest, ship, planetWeights) {
    return planetsOfInterest.map(planet => {
        const score = getPlanetScore(ship, planet, planetWeights.get(planet));

        return new Action(score, "spread", planet);
    });
}

function getPlanetScore(ship, planet, weight) {
    const distPct = 1 - Geometry.distance(ship, planet) / maxDistance;
    const gain = weight / 14;
    return distPct + gain;
}

function attack(ship, gameMap) {
    return gameMap.enemyShips
        .map(enemy => {
            const position = getAttackPosition(gameMap, enemy);
            const planetCollision = gameMap.planets
                .some(planet => Geometry.distance(planet, position) < planet.radius);

            const score = planetCollision ? -1 : getAttackScore(ship, enemy, position);

            return new Action(score, "attack", position);
        });
}

function getAttackScore(ship, enemy, attackPosition) {
    const distancePct = 1 - Geometry.distance(ship, attackPosition) / maxDistance;
    const ease = !enemy.isUndocked() ? 2 : 1;
    return distancePct * ease;
}

function getAttackPosition(gameMap, enemy) {
    let [x, y] = gameMap.enemyShips
        .filter(e => Geometry.distance(enemy, e) < constants.WEAPON_RADIUS * 2)
        .map(e => [e.x - enemy.x, e.y - enemy.y])
        .reduce((prev, cur) => [prev[0] + cur[0], prev[1] + cur[1]], [0, 0]);

    const length = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    if (length) {
        const targetDistance = 4;
        [x, y] = [x / length * targetDistance, y / length * targetDistance];
    }

    return {x: enemy.x - x, y: enemy.y - y};
}

module.exports = {strategy};