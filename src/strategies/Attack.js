const constants = require('../hlt/Constants');
const Geometry = require('../hlt/Geometry');
const Simulation = require('./Simulation');
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

            // make the score of attack positions, which lie inside planets, negative
            const planetCollision = gameMap.planets
                .some(planet => Geometry.distance(planet, position) < planet.radius);
            const score = planetCollision ? -1 : getAttackScore(ship, enemy, position, gameMap);

            return new Intent(score, "attack", position);
        });
}

function getAttackScore(ship, enemy, attackPosition, gameMap) {
    const distance = Geometry.distance(ship, attackPosition);
    const distancePct = 1 - distance / maxDistance;

    // if the docked enemy can be reached before its planet produces another ship
    let unprotectedPlanet = -0.25;
    if (!enemy.isUndocked()) {
        const planet = Simulation.nearestEntity(gameMap.planets, enemy).entity;

        const turnsTillReach = distance / constants.MAX_SPEED;
        const turnsTillNewShip = Simulation.turnsTillNextShip(planet);

        if (turnsTillReach <= turnsTillNewShip)
            unprotectedPlanet = 0.25;
    }

    const ease = enemy.isUndocked() ? 1 : 2;
    return distancePct * ease + unprotectedPlanet;
}

/**
 * get the position for the most effective attack.
 * if more enemies are in close proximity, we want a location which only attacks the
 * target and not the enemies around it for fastest destruction.
 *
 * @param gameMap The map
 * @param ship The ship to attack with
 * @param enemy The enemy to attack
 * @returns {*}
 */
function getAttackPosition(gameMap, ship, enemy) {
    // find all close enemies and reduce to a vector pointing away from them
    let [x, y] = gameMap.enemyShips
        .filter(e => Geometry.distance(enemy, e) < constants.WEAPON_RADIUS * 2)
        .map(e => [e.x - enemy.x, e.y - enemy.y])
        .reduce((prev, cur) => [prev[0] + cur[0], prev[1] + cur[1]], [0, 0]);

    // if the vector has length shrink it to a length that is still in the attack radius
    const length = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    if (length) {
        const targetDistance = 3;
        [x, y] = [x / length * targetDistance, y / length * targetDistance];
        return {x: enemy.x - x, y: enemy.y - y};
    }

    // else find the position nearest to us in attack proximity to the enemy
    return ship.pointApproaching(enemy, 3);
}

module.exports = {attack};