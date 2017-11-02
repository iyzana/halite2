const constants = require('../hlt/Constants');
const Geometry = require('../hlt/Geometry');
const log = require('../hlt/Log');

const Intent = require('./Intent');

let maxDistance;

function attack(ship, gameMap) {
    if (!maxDistance) {
        maxDistance = Math.sqrt(Math.pow(gameMap.width, 2) + Math.pow(gameMap.height, 2));
    }

    return gameMap.enemyShips
        .map(enemy => {
            const position = getAttackPosition(gameMap, ship, enemy);
            const planetCollision = gameMap.planets
                .some(planet => Geometry.distance(planet, position) < planet.radius);

            const score = planetCollision ? -1 : getAttackScore(ship, enemy, position, gameMap);

            return new Intent(score, "attack", position);
        });
}

function getAttackScore(ship, enemy, attackPosition, gameMap) {
    const distance = Geometry.distance(ship, attackPosition);
    const distancePct = 1 - distance / maxDistance;

    let unprotectedPlanet = -0.25;
    if(!enemy.isUndocked()) {
        const [_, planet] = gameMap.planets.reduce((acc, p) => {
            const dist = Geometry.distance(enemy, p);
                return dist < acc[0] ? [dist, p] : acc;
        }, [Infinity, null]);

        const turnsTillReach = distance/constants.MAX_SPEED;
        const turnsTillNewShip = (72 - planet.currentProduction)/(planet.numberOfDockedShips*constants.BASE_PRODUCTIVITY);

        if(turnsTillReach <= turnsTillNewShip)
            unprotectedPlanet = 0.25;
    }
    const ease = enemy.isUndocked() ? 1 : 2;
    return distancePct * ease + unprotectedPlanet;
}

function getAttackPosition(gameMap, ship, enemy) {
    let [x, y] = gameMap.enemyShips
        .filter(e => Geometry.distance(enemy, e) < constants.WEAPON_RADIUS * 2)
        .map(e => [e.x - enemy.x, e.y - enemy.y])
        .reduce((prev, cur) => [prev[0] + cur[0], prev[1] + cur[1]], [0, 0]);

    const length = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    if (length) {
        const targetDistance = 3;
        [x, y] = [x / length * targetDistance, y / length * targetDistance];
        return {x: enemy.x - x, y: enemy.y - y};
    }

    return Geometry.reduceEnd(ship, enemy, 3);
}

module.exports = {attack};