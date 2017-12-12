const Geometry = require('../hlt/Geometry');
const Simulation = require('./Simulation');
const constants = require('../hlt/Constants');
const log = require('../hlt/Log');

/**
 * finds a speed and angle suited for navigating from ship to destination.
 * an ignored entity can provided if the collision with it should not be avoided.
 *
 * @param gameMap The map
 * @param ship ship to navigate
 * @param to location to go to
 * @param finalTo final target retained throughout recursion
 * @param depth search depth
 * @returns {{speed: number, angle: number}}
 */
function findPath(gameMap, ship, to, finalTo, depth, additionalObstacles) {
    if (!additionalObstacles)
        additionalObstacles = [];
    if (!depth) {
        depth = 0;
        finalTo = to;
    }
    if (depth >= 6)
        return undefined;

    log.log("path from " + ship + " to [" + to.x + "," + to.y + "]");

    // there could be missed collisions when the angle and speed between ship and target are not discrete
    const requestedVector = Simulation.toVector(Math.max(1, Geometry.distance(ship, to)), Geometry.angleInDegree(ship, to));
    to.x = ship.x + requestedVector.x;
    to.y = ship.y + requestedVector.y;

    log.log("discrete angled to: [" + to.x + "," + to.y + "]");

    const nearbyShips = gameMap.myShips
        .filter(s => {
            if (!s.isUndocked())
                return true;

            if (Geometry.distance(ship, s) <= 2 * constants.MAX_SPEED + 2 * constants.SHIP_RADIUS) {
                return true;
            }

            if (Geometry.distance(ship, s) <= 2.5) {
                return true;
            }

            if (Geometry.distance(ship, s) <= constants.MAX_SPEED + 2 * constants.SHIP_RADIUS) {
                const nearestPlanet = Simulation.nearestEntity(gameMap.planets, s);

                if (s.canDock(nearestPlanet.entity))
                    return true;
            }

            return false;
        })
        .filter(s => s.id !== ship.id);

    let obstacles = obstaclesBetween(gameMap.planets, ship, to).concat(obstaclesBetween(nearbyShips, ship, to)).concat(obstaclesBetween(additionalObstacles, ship, to));

    if (obstacles.length) {
        log.log(obstacles.length + " obstacles");

        // find closest obstacle
        obstacles.sort((a, b) => Geometry.distance(ship, b) - Geometry.distance(ship, a));

        const obstacle = obstacles[0];

        log.log("avoiding obstacle " + obstacle);

        const angle = Geometry.angleInRad(ship, to);
        const escapeLength = obstacle.radius + 0.7;

        log.log("angle: " + angle);
        log.log("length: " + escapeLength);

        let dx = escapeLength * Math.sin(angle);
        let dy = escapeLength * Math.cos(angle);

        const escapePointA = {x: obstacle.x + dx, y: obstacle.y - dy};
        const escapePointB = {x: obstacle.x - dx, y: obstacle.y + dy};
        const distanceA = Geometry.distance(ship, escapePointA);
        let distanceB = Geometry.distance(ship, escapePointB);

        let escapePoint = distanceA < distanceB ? escapePointA : escapePointB;
        escapePoint = findNearestEscapePoint(escapePoint, ship, finalTo, to);

        // log.log("escapePointA: " + JSON.stringify(escapePointA));
        // log.log("escapePointB: " + JSON.stringify(escapePointB));
        log.log("escapePoint: " + JSON.stringify(escapePoint));

        const result = findPath(gameMap, ship, escapePoint, finalTo, depth + 1, additionalObstacles);

        if (!result) {
            escapePoint = distanceA >= distanceB ? escapePointA : escapePointB;
            escapePoint = findNearestEscapePoint(escapePoint, ship, finalTo, to);

            log.log("switched escapePoint: " + JSON.stringify(escapePoint));

            const result = findPath(gameMap, ship, escapePoint, finalTo, depth + 1, additionalObstacles);

            if (!result && depth === 0)
                return {speed: 0, angle: 0};
            else
                return result;
        }

        return result;
    }

    log.log("no obstacles");

    const distance = Geometry.distance(ship, to);
    const angle = Geometry.angleInDegree(ship, to);
    const speed = Math.max(1, distance >= constants.MAX_SPEED ? constants.MAX_SPEED : distance);
    log.log(">" + speed + " ø" + angle);

    return {speed, angle};
}

function findNearestEscapePoint(escapePoint, ship, finalTo, to) {
    let bestEscapePoint = escapePoint;

    // find speed along escapePoint line, which gets the ship closest to the target
    for (let i = 1; i <= 7; i++) {
        let consideredEscapePoint = Geometry.reduceEnd(ship, escapePoint, -i);
        if (Geometry.distance(consideredEscapePoint, finalTo) < Geometry.distance(bestEscapePoint, finalTo) ||
            Geometry.distance(consideredEscapePoint, to) < Geometry.distance(bestEscapePoint, to))
            bestEscapePoint = consideredEscapePoint;
    }
    return bestEscapePoint;
}

function obstaclesBetween(obstacles, from, to) {
    return obstacles.filter(o => Geometry.intersectSegmentCircle(from, to, o, 0.505))
}

module.exports = {findPath};