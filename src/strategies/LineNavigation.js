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

    const groupedObstacles = additionalObstacles.groupBy(o => Geometry.distance(ship, o) <= o.radius);
    const outsideObstacles = groupedObstacles.filter(e => e.key === false).flatMap(e => e.values) || [];
    const insideObstacles = groupedObstacles.filter(e => e.key === true).flatMap(e => e.values) || [];

    log.log(JSON.stringify(groupedObstacles));
    log.log(JSON.stringify(outsideObstacles));
    log.log(JSON.stringify(insideObstacles));

    if(additionalObstacles.length > 0) {
        log.log("insideObstacles not empty!");
    }

    let obstacles = obstaclesBetween(gameMap.planets, ship, to).concat(obstaclesBetween(nearbyShips, ship, to)).concat(obstaclesBetween(outsideObstacles, ship, to));

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
    let angle = Geometry.angleInDegree(ship, to);
    const speed = Math.max(1, distance >= constants.MAX_SPEED ? constants.MAX_SPEED : distance);


    if (insideObstacles.length > 0) {
        log.log("inside " + insideObstacles.length + " ships next turn attack radius");
        const circle = {
            x: ship.x,
            y: ship.y,
            radius: constants.MAX_SPEED
        };

        log.log("myCircle: " + JSON.stringify(circle));

        let circleIntersections = insideObstacles.map(c => [c, Geometry.intersectCircles(circle, c)]);

        log.log("circleIntersections: " + JSON.stringify(circleIntersections));

        const cantEscapeObstacles = circleIntersections
            .filter(c => c[1].length === 0)
            .map(c => c[0]);

        if(cantEscapeObstacles.length > 0) {
            //we cant escape but we can try...
            log.log("we're just to close :(");

            log.log(JSON.stringify(cantEscapeObstacles));
            const theirPos = Geometry.averagePos(cantEscapeObstacles);
            log.log(JSON.stringify(theirPos));

            const vector = Geometry.normalizeVector({
                x: ship.x - theirPos.x,
                y: ship.y - theirPos.y,
            });

            log.log(JSON.stringify(vector));

            const retreatPoint = {
                x: theirPos.x + vector.x * 19,
                y: theirPos.y + vector.y * 19,
            };

            log.log(JSON.stringify(retreatPoint));

            return findPath(gameMap, ship, retreatPoint);
        }

        const planetIntersections = gameMap.planets
            .filter(p => Geometry.distance(p, ship) <= p.radius+ship.radius+circle.radius)
            .map(p => Geometry.intersectCircles({x: p.x, y: p.y, radius: p.radius+ship.radius}, circle))
            .map(i => [i[1], i[0]]);

        circleIntersections = circleIntersections.map(c => c[1]).concat(planetIntersections);
        const angleIntervals = circleIntersections
            .map(o => {
                log.log("circleIntersect: " + JSON.stringify(o));
                return o;
            })
            .map(i => i.map(pos => Geometry.angleInDegree(ship, pos)))
            .map(o => {
                log.log("toDegree: " + JSON.stringify(o));
                return o;
            })
            .map(interval => {
                log.log(JSON.stringify(interval));
                if (interval.length === 1)
                    return {start: interval[0], end: interval[0]};
                else
                    return {start: interval[0], end: interval[1]};
            });

        log.log("intervals: " + JSON.stringify(angleIntervals));

        const intersections = Geometry.angleIntervalIntersections(angleIntervals)
            .map(i => ({start: Math.ceil(i.start), end: Math.floor(i.end)})); //make real angle

        log.log("intersections: " + JSON.stringify(intersections));
        if (intersections.length === 0) {
            log.log("escape not possible");
            angle = Geometry.inverseWeightedAverageMidpoints(angleIntervals);
        } else {
            if (!intersections.some(i => Geometry.angleInRange(angle, i.start, i.end))) {
                const escapeAngles = intersections
                    .flatMap(i => [i.start, i.end])
                    .sort((a, b) => Math.abs(Geometry.angleBetween(a, angle)) - Math.abs(Geometry.angleBetween(b, angle)));

                angle = escapeAngles[0];
            }
        }
    }

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