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
function findPath(gameMap, ship, to, additionalObstacles, finalTo, depth) {
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

            return Geometry.distance(ship, s) <= 2 * constants.MAX_SPEED + 2 * constants.SHIP_RADIUS;
        })
        .filter(s => s.id !== ship.id);

    const groupedObstacles = additionalObstacles.groupBy(o => Geometry.distance(ship, o) <= o.radius + ship.radius);
    const outsideObstacles = groupedObstacles.filter(e => e.key === false).flatMap(e => e.values) || [];
    let insideObstacles = groupedObstacles.filter(e => e.key === true).flatMap(e => e.values) || [];

    insideObstacles = insideObstacles.filter(o => obstaclesBetween(gameMap.planets, ship, o, -1).length === 0);

    let obstacles = obstaclesBetween(gameMap.planets, ship, to).concat(obstaclesBetween(nearbyShips, ship, to)).concat(obstaclesBetween(outsideObstacles, ship, to));

    if (obstacles.length) {
        log.log(obstacles.length + " obstacles");

        // find closest obstacle
        obstacles.sort((a, b) => Geometry.distance(ship, b) - Geometry.distance(ship, a));

        const obstacle = obstacles[0];

        log.log("avoiding obstacle " + obstacle);

        let [escapePointA, escapePointB] = getEscapePoints(ship, obstacle, ship.radius);

        let requestedVector = Simulation.toVector(Math.max(1, Geometry.distance(ship, escapePointA)), Geometry.angleInDegree(ship, escapePointA) + 1);
        escapePointA.x = ship.x + requestedVector.x;
        escapePointA.y = ship.y + requestedVector.y;

        requestedVector = Simulation.toVector(Math.max(1, Geometry.distance(ship, escapePointB)), Geometry.angleInDegree(ship, escapePointB));
        escapePointB.x = ship.x + requestedVector.x;
        escapePointB.y = ship.y + requestedVector.y;

        const distanceA = Geometry.distance(to, escapePointA);
        let distanceB = Geometry.distance(to, escapePointB);

        let escapePoint = distanceA < distanceB ? escapePointA : escapePointB;
        escapePoint = findNearestEscapePoint(escapePoint, ship, finalTo, to, gameMap.planets);

        // log.log("escapePointA: " + JSON.stringify(escapePointA));
        // log.log("escapePointB: " + JSON.stringify(escapePointB));
        log.log("escapePoint: " + JSON.stringify(escapePoint));

        const result = findPath(gameMap, ship, escapePoint, additionalObstacles, finalTo, depth + 1);

        if (!result) {
            escapePoint = distanceA >= distanceB ? escapePointA : escapePointB;
            escapePoint = findNearestEscapePoint(escapePoint, ship, finalTo, to, gameMap.planets);

            log.log("switched escapePoint: " + JSON.stringify(escapePoint));

            const result = findPath(gameMap, ship, escapePoint, additionalObstacles, finalTo, depth + 1);

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
    let speed = Math.max(1, distance >= constants.MAX_SPEED ? constants.MAX_SPEED : distance);

    // escape close enemy ships
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

        if (cantEscapeObstacles.length > 0) {
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

        const outsideObstacleIntersections = outsideObstacles
            .filter(o => Geometry.distance(ship, o) <= o.radius + circle.radius)
            .map(o => Geometry.intersectCircles(circle, o));

        circleIntersections = circleIntersections
            .map(c => c[1])
            .concat(outsideObstacleIntersections);
        const angleIntervals = circleIntersections
            .map(i => i.map(pos => Geometry.angleInDegree(ship, pos)))
            .map(interval => {
                if (interval.length === 1)
                    return {start: interval[0], end: interval[0]};
                else
                    return {start: interval[0], end: interval[1]};
            });

        log.log("intervals: " + JSON.stringify(angleIntervals));

        let intersections = Geometry.angleIntervalIntersections(angleIntervals)
            .map(i => ({start: Math.ceil(i.start), end: Math.floor(i.end)})); //make real angle

        log.log("intersections: " + JSON.stringify(intersections));
        if (intersections.length === 0) {
            log.log("escape not possible");
            angle = Geometry.inverseWeightedAverageMidpoints(angleIntervals);
        } else {

            //TODO: only looks at our current position...we should look some turns into the future
            const wallIntersections = Simulation.intersectWallsWithCircle(gameMap, circle);

            const dockedShipIntersections = gameMap.myShips
                .filter(s => !s.isUndocked())
                .filter(s => Geometry.distance(ship, s) < constants.MAX_SPEED + constants.SHIP_RADIUS * 2)
                .map(s => getEscapePoints(ship, s, ship.radius));

            const planetIntersections = gameMap.planets
                .filter(p => Geometry.distance(p, ship) <= p.radius + ship.radius + circle.radius)
                .map(p => [p, Geometry.intersectCircles({x: p.x, y: p.y, radius: p.radius + ship.radius}, circle)])
                .map(([p, i]) => {
                    if (Geometry.intersectSegmentCircle(ship, i[0], p, ship.radius)) {
                        return [p, getEscapePoints(ship, p, ship.radius)];
                    }
                    return [p, i.length === 2 ? [i[1], i[0]] : i];
                })
                .map(([p, i]) => i);

            const environmentIntersections = planetIntersections
                .concat(wallIntersections)
                .concat(dockedShipIntersections)
                .map(i => i.map(pos => Geometry.angleInDegree(ship, pos)))
                .map(interval => {
                    if (interval.length === 1)
                        return {start: interval[0], end: interval[0]};
                    else
                        return {start: interval[0], end: interval[1]};
                })
                .map(i => ({start: Math.ceil(i.start), end: Math.floor(i.end)}));

            log.log("environmentIntersections: " + JSON.stringify(environmentIntersections));

            if (environmentIntersections.length > 0)
                intersections = Geometry.angleIntervalIntersections(intersections.concat(environmentIntersections));

            if (intersections.length === 0) {
                log.log("colliding with environment on all escape paths");

                const environmentEscapes = environmentIntersections
                    .flatMap(interval => {
                        return [interval.start, interval.end];
                    }).map(angle => {
                        const pos = Simulation.positionNextTick(ship, 7, angle);

                        const avgDist = insideObstacles
                            .map(o => Geometry.distance(o, pos))
                            .reduce((acc, cur) => acc + cur, 0) / insideObstacles.length;

                        return {angle, avgDist};
                    })
                    .sort((a, b) => b.avgDist - a.avgDist);

                log.log("environment escape angles(weighted): " + JSON.stringify(environmentEscapes));

                angle = environmentEscapes[0].angle;
            } else {
                if (!intersections.some(i => Geometry.angleInRange(angle, i.start, i.end))) {
                    const escapeAngles = intersections
                        .flatMap(i => [i.start, i.end])
                        .sort((a, b) => Math.abs(Geometry.angleBetween(a, angle)) - Math.abs(Geometry.angleBetween(b, angle)));

                    angle = escapeAngles[0];
                }
            }
        }

        const nextPos = Simulation.positionNextTick(ship, speed, angle);

        if (additionalObstacles.some(o => Geometry.distance(nextPos, o) <= o.radius + ship.radius)) {
            speed = 7;
        }
    }

    log.log(">" + speed + " ø" + angle);
    return {speed, angle};
}

function getEscapePoints(ship, obstacle, fudge) {
    const thalesCircle = {
        x: ship.x + (obstacle.x - ship.x) / 2,
        y: ship.y + (obstacle.y - ship.y) / 2,
        radius: Geometry.distance(ship, obstacle) / 2
    };

    const fudgedObstacle = {
        x: obstacle.x,
        y: obstacle.y,
        radius: obstacle.radius + fudge
    };

    return Geometry.intersectCircles(thalesCircle, fudgedObstacle);
}

function findNearestEscapePoint(escapePoint, ship, finalTo, to, obstacles) {
    let bestEscapePoint = escapePoint;

    // find speed along escapePoint line, which gets the ship closest to the target and not inside an obstacle
    for (let i = 1; i <= 7; i++) {
        let consideredEscapePoint = Geometry.reduceEnd(ship, escapePoint, -i);
        if ((Geometry.distance(consideredEscapePoint, finalTo) < Geometry.distance(bestEscapePoint, finalTo) ||
                Geometry.distance(consideredEscapePoint, to) < Geometry.distance(bestEscapePoint, to))
            && obstacles.every(o => Geometry.distance(consideredEscapePoint, o) > o.radius + ship.radius))
            bestEscapePoint = consideredEscapePoint;
    }
    return bestEscapePoint;
}

function obstaclesBetween(obstacles, from, to, fudge) {
    if (!fudge) fudge = constants.SHIP_RADIUS;
    return obstacles.filter(o => Geometry.intersectSegmentCircle(from, to, o, fudge))
}

module.exports = {findPath};
