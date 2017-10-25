const constants = require('../hlt/Constants');
const Geometry = require('../hlt/Geometry');
const log = require('../hlt/Log');

const Action = require('./Action');

let maxDistance;

function attack(ship, gameMap) {
    if (!maxDistance) {
        maxDistance = Math.sqrt(Math.pow(gameMap.width, 2) + Math.pow(gameMap.height, 2));
    }

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

module.exports = {attack};