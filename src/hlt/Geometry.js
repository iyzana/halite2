class Geometry {
    /**
     * distance between two points
     * @param start object with {x, y} properties
     * @param end object with {x, y} properties
     * @returns {number} distance
     */
    static distance(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
    }

    /**
     * angle in rad between two points
     * @param {object} start object with {x, y} properties
     * @param {object} end object with {x, y} properties
     * @returns {number} radian between 0 and 2*PI
     */
    static angleInRad(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        const atan = Math.atan2(dy, dx);
        return atan >= 0 ? atan : (atan + 2 * Math.PI);
    }

    /**
     * angle in degree between two points
     * @param {object} start object with {x, y} properties
     * @param {object} end object with {x, y} properties
     * @returns {number} angle between 0 and 360
     */
    static angleInDegree(start, end) {
        return Geometry.toDegree(this.angleInRad(start, end));
    }

    /**
     * angle in degrees between two angles
     *
     * @param {number} angle1 from angle in degrees
     * @param {number} angle2 to angle in degrees
     * @returns {number} angle between angles in degrees
     */
    static angleBetween(angle1, angle2) {
        return Geometry.mod(angle2 - angle1 + 180, 360) - 180;
    }

    /**
     * Calculate remainder, but ignore sign
     *
     * @param a dividend
     * @param n divisor
     * @returns {number} positive remainder
     */
    static mod(a, n) {
        return a - Math.floor(a / n) * n
    }

    /**
     * given start and end positions, adjust end position by rotating line by specified degree
     * @param {object} start object with {x, y} properties
     * @param {object} end object with {x, y} properties
     * @param degreeDelta delta in degree
     */
    static rotateEnd(start, end, degreeDelta) {
        const distance = Geometry.distance(start, end);
        const angleDegree = Geometry.angleInDegree(start, end);

        const newAngleDegree = angleDegree + degreeDelta;
        const newAngleRad = Geometry.toRad(newAngleDegree);
        const x = Math.cos(newAngleRad) * distance;
        const y = Math.sin(newAngleRad) * distance;

        return {x: start.x + x, y: start.y + y};
    }

    /**
     * find the closest point to the given end position near the given target, outside its given radius,
     * with an added fudge of min_distance.
     * @param start {object} start object with {x, y} properties
     * @param end {object} end object with {x, y} properties
     * @param delta distance by what reduce the end position
     */
    static reduceEnd(start, end, delta) {
        const angleRad = Geometry.angleInRad(start, end);

        const dx = Math.cos(angleRad) * delta;
        const dy = Math.sin(angleRad) * delta;

        return {x: end.x - dx, y: end.y - dy};
    }

    /**
     * converts rad to degree
     * @param {number} rad
     * @return {number} degree
     */
    static toDegree(rad) {
        return rad * 180.0 / Math.PI;
    }

    /**
     * converts degree to rad
     * @param {number} degree
     * @return {number} rad
     */
    static toRad(degree) {
        return degree * Math.PI / 180.0;
    }

    /**
     * averages the position of the given entities
     * @param {Array} entities
     */
    static averagePos(entities) {
        const pos = entities.reduce((acc, cur) => {
            acc.x += cur.x;
            acc.y += cur.y;
            return acc;
        }, {x: 0, y: 0});

        pos.x /= entities.length;
        pos.y /= entities.length;
        return pos;
    }

    /**
     * normalizes the vector, so it's length is 1
     * @param vector
     * @returns {object} unitVector
     */
    static normalizeVector(vector) {
        const length = Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
        vector.x /= length;
        vector.y /= length;
        return vector;
    }

    /**
     * Test whether a line segment and circle intersect.
     * @param {object} start object with {x, y} properties
     * @param {object} end object with {x, y} properties
     * @param {object} circle object with {x, y, radius} properties
     * @param {number} [fudge] fudge factor: additional distance to leave between the segment and circle
     * @returns {boolean} true if intersects, false - otherwise
     */
    static intersectSegmentCircle(start, end, circle, fudge) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        const a = dx ** 2 + dy ** 2;

        if (a === 0.0) {
            return Geometry.distance(start, circle) <= (circle.radius + fudge);
        }

        const b = -2 * (start.x ** 2 - start.x * end.x - start.x * circle.x + end.x * circle.x +
            start.y ** 2 - start.y * end.y - start.y * circle.y + end.y * circle.y);

        const t = Math.min(-b / (2 * a), 1.0);
        if (t < 0) {
            return false;
        }

        const closestX = start.x + dx * t;
        const closestY = start.y + dy * t;
        const closestDistance = Geometry.distance({x: closestX, y: closestY}, circle);

        return closestDistance <= circle.radius + fudge;
    }

    /**
     * Calculates the intersection points of two circles
     * @param c1
     * @param c2
     * @returns {*}
     */
    static intersectCircles(c1, c2) {
        //same circle passed
        if (c1.x === c2.x && c1.y === c2.y && c1.radius === c2.radius) {
            return Infinity; //Infinite number of intersection points
        }

        const distance = Geometry.distance(c1, c2);
        if (distance > c1.radius + c2.radius)
            return [];

        //solve circle equation: x**2+y**2=r**2 assuming c1 is at (0,0) and c2 is on the x-axis
        const x = (c1.radius ** 2 + distance ** 2 - c2.radius ** 2) / (2 * distance);
        const y = Math.sqrt(c1.radius ** 2 - x ** 2);

        //translate solutions to right position
        const baseVectorX = Geometry.normalizeVector({
            x: c2.x - c1.x,
            y: c2.y - c1.y,
        });
        const baseVectorY = {
            x: -baseVectorX.y,
            y: baseVectorX.x,
        };

        baseVectorX.x *= x;
        baseVectorX.y *= x;
        baseVectorY.x *= y;
        baseVectorY.y *= y;

        //only one intersection point
        if (y === 0) {
            return [c1];
        }

        const intersect1 = {
            x: c1.x + baseVectorX.x + baseVectorY.x,
            y: c1.y + baseVectorX.y + baseVectorY.y,
        };

        const intersect2 = {
            x: c1.x + baseVectorX.x - baseVectorY.x,
            y: c1.y + baseVectorX.y - baseVectorY.y,
        };

        return [intersect1, intersect2];
    }

    static asPositiveAngle(angle) {
        return (angle % 360 + 360) % 360;
    }

    static clockwiseAngleBetween(angle1, angle2) {
        return Geometry.asPositiveAngle(Geometry.angleBetween(angle1, angle2));
    }

    static angleIntervalIntersections(intervals) {
        function byNearestClockwise(angle) {
            return (a, b) => Geometry.clockwiseAngleBetween(angle, a) - Geometry.clockwiseAngleBetween(angle, b);
        }

        return intervals.map(i => i.start)
            .filter(angle => intervals.every(({start, end}) => this.angleInRange(angle, start, end)))
            .map(angle => ({
                start: angle,
                end: intervals.map(i => i.end).sort(byNearestClockwise(angle))[0]
            }));
    }

    /**
     * black angular magic, touch at risk of the universe
     *
     * @param intervals The intervals for which to calculate the optimal escape angle
     * @returns {number} optimal escape angle in degrees between 0 and 360
     */
    static inverseWeightedAverageMidpoints(intervals) {
        const midpoints = intervals.map(i => ({
            weight: Math.pow(1 - Geometry.clockwiseAngleBetween(i.start, i.end) / 360, 2),
            midpoint: i.start < i.end ? (i.start + i.end) / 2 : this.asPositiveAngle((i.start + i.end - 360) / 2)
        }));

        const count = intervals.length;
        const weightSum = midpoints.reduce((acc, c) => acc + c.weight, 0);
        // used for circle wrap around
        const maxAngle = 180 * (count - 1);

        let sortedMidPoints = midpoints.sort((a, b) => a.midpoint - b.midpoint);

        while (sortedMidPoints.reduce((acc, c) => acc + c.midpoint - sortedMidPoints[0].midpoint, 0) > maxAngle) {
            sortedMidPoints[0].midpoint += 360;

            const highest = sortedMidPoints[0];
            sortedMidPoints = sortedMidPoints.slice(1, count);
            sortedMidPoints.push(highest);
        }

        return (midpoints.reduce((acc, c) => acc + c.weight * c.midpoint, 0) / weightSum) % 360;
    }

    static angleInRange(angle, start, end) {
        angle %= 360;
        start %= 360;
        end %= 360;

        if (start <= end) {
            return angle >= start && angle <= end;
        } else {
            return angle >= start || angle <= end;
        }
    }
}

module.exports = Geometry;