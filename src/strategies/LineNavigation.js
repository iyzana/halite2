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
 * @param ignore some entity to ignore while navigation
 * @param depth search depth
 * @returns {{speed: number, angle: number}}
 */
function findPath(gameMap, ship, to, ignore, finalTo, depth) {
    if (!depth) {
        depth = 0;
        finalTo = to;
    }
    if (depth >= 10)
        return undefined;

    log.log("path from " + ship + " to [" + to.x + "," + to.y + "]");

    // there could be missed collisions when the angle and speed between ship and target are not discrete
    const requestedVector = Simulation.toVector(Math.max(1, Geometry.distance(ship, to)), Geometry.angleInDegree(ship, to));
    to.x = ship.x + requestedVector.x;
    to.y = ship.y + requestedVector.y;

    log.log("discrete angled to: [" + to.x + "," + to.y + "]");

    const allShips = gameMap.allShips
        .filter(s => s.id !== ship.id && (!ignore || s.id !== ignore.id));

    let obstacles = obstaclesBetween(gameMap.planets, ship, to).concat(obstaclesBetween(allShips, ship, to));

    if (obstacles.length) {
        log.log(obstacles.length + " obstacles");

        // find closest obstacle
        obstacles.sort((a, b) => Geometry.distance(ship, a) - Geometry.distance(ship, b));

        const obstacle = obstacles[0];

        log.log("avoiding obstacle " + obstacle);

        const angle = Geometry.angleInRad(ship, to);
        const escapeLength = obstacle.radius + 0.52;

        log.log("angle: " + angle);
        log.log("length: " + escapeLength);

        let dx = escapeLength * Math.sin(angle);
        let dy = escapeLength * Math.cos(angle);

        const escapePointA = {x: obstacle.x + dx, y: obstacle.y - dy};
        const escapePointB = {x: obstacle.x - dx, y: obstacle.y + dy};
        const distanceA = Geometry.distance(ship, escapePointA);
        let distanceB = Geometry.distance(ship, escapePointB);

        let escapePoint = distanceA < distanceB ? escapePointA : escapePointB;

        // find speed along escapePoint line, which gets us closest to the target
        for (let i = 1; i <= 7; i++) {
            let consideredEscapePoint = Geometry.reduceEnd(ship, escapePoint, -1);
            if (Geometry.distance(consideredEscapePoint, finalTo) < Geometry.distance(escapePoint, finalTo) ||
                Geometry.distance(consideredEscapePoint, to) < Geometry.distance(escapePoint, to))
                escapePoint = consideredEscapePoint;
        }


        // log.log("escapePointA: " + JSON.stringify(escapePointA));
        // log.log("escapePointB: " + JSON.stringify(escapePointB));
        log.log("escapePoint: " + JSON.stringify(escapePoint));

        const result = findPath(gameMap, ship, escapePoint, ignore, finalTo, depth + 1);

        if (!result) {
            escapePoint = distanceA >= distanceB ? escapePointA : escapePointB;

            // find speed along escapePoint line, which gets us closest to the target
            for (let i = 1; i <= 7; i++) {
                let consideredEscapePoint = Geometry.reduceEnd(ship, escapePoint, -1);
                if (Geometry.distance(consideredEscapePoint, finalTo) < Geometry.distance(escapePoint, finalTo) ||
                    Geometry.distance(consideredEscapePoint, to) < Geometry.distance(escapePoint, to))
                    escapePoint = consideredEscapePoint;
            }

            log.log("switched escapePoint: " + JSON.stringify(escapePoint));

            const result = findPath(gameMap, ship, escapePoint, ignore, finalTo, depth + 1);

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

function obstaclesBetween(obstacles, from, to) {
    return obstacles.filter(o => Geometry.intersectSegmentCircle(from, to, o, 0.505))
}

module.exports = {findPath};