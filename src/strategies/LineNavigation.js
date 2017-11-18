const Geometry = require('../hlt/Geometry');
const constants = require('../hlt/Constants');
const log = require('../hlt/Log');

/**
 * finds a speed and angle suited for navigating from ship to destination.
 * an ignored entity can provided if the collision with it should not be avoided.
 *
 * @param gameMap The map
 * @param ship ship to navigate
 * @param to location to go to
 * @param ignore some entity to ignore while navigation
 * @param depth search depth
 * @returns {{speed: number, angle: number}}
 */
function findPath(gameMap, ship, to, ignore, depth) {
    if (!depth)
        depth = 0;
    if (depth >= 10)
        return undefined;

    const allShips = gameMap.allShips
        .filter(s => s.id !== ship.id && (!ignore || s.id !== ignore.id));

    // log.log("path from " + ship + " to [" + Math.floor(to.x) + "," + Math.floor(to.y) + "]");

    let obstacles = obstaclesBetween(gameMap.planets, ship, to).concat(obstaclesBetween(allShips, ship, to));

    if (obstacles.length) {
        // log.log(obstacles.length + " obstacles");

        // find closest obstacle
        obstacles.sort((a, b) => Geometry.distance(ship, a) - Geometry.distance(ship, b));

        const obstacle = obstacles[0];

        // log.log("avoiding obstacle " + obstacle);

        const angle = Geometry.angleInRad(ship, to);
        const escapeLength = obstacle.radius + 0.8;


        // log.log("angle: " + angle);
        // log.log("length: " + escapeLength);

        let dx = escapeLength * Math.sin(angle);
        let dy = escapeLength * Math.cos(angle);

        const escapePointA = {x: obstacle.x + dx, y: obstacle.y - dy};
        const escapePointB = {x: obstacle.x - dx, y: obstacle.y + dy};
        const distanceA = Geometry.distance(ship, escapePointA);
        let distanceB = Geometry.distance(ship, escapePointB);

        let escapePoint = Geometry.reduceEnd(ship, distanceA < distanceB ? escapePointA : escapePointB, -10);

        // log.log("escapePointA: " + JSON.stringify(escapePointA));
        // log.log("escapePointB: " + JSON.stringify(escapePointB));
        // log.log("escapePoint: " + JSON.stringify(escapePoint));

        const result = findPath(gameMap, ship, escapePoint, ignore, depth + 1);

        if (!result) {
            let escapePoint = Geometry.reduceEnd(ship, distanceA >= distanceB ? escapePointA : escapePointB, -10);
            const result = findPath(gameMap, ship, escapePoint, ignore, depth + 1);

            if (!result && depth === 0)
                return {speed: 0, angle: 0};
            else
                return result;
        }

        return result;
    }

    // log.log("no obstacles");

    const distance = Geometry.distance(ship, to);
    const angle = Geometry.angleInDegree(ship, to);
    const speed = Math.max(1, distance >= constants.MAX_SPEED ? constants.MAX_SPEED : distance);
    // log.log(">" + speed + " ø" + angle);
    return {speed, angle};
}

function obstaclesBetween(obstacles, from, to) {
    return obstacles.filter(o => Geometry.intersectSegmentCircle(from, to, o, 0.7))
}

module.exports = {findPath};