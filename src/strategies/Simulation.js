const Geometry = require('../hlt/Geometry');
const constants = require('../hlt/Constants');

class Simulation {
    /**
     * converts speed and angle to the x and y vector it results in.
     * speed and angle are floored.
     *
     * @param speed speed from 0 to 7
     * @param angle angle in degrees
     * @returns {{x: number, y: number}}
     */
    static toVector(speed, angle) {
        return {
            x: Math.floor(speed) * Math.cos(Geometry.toRad(Math.floor(angle))),
            y: Math.floor(speed) * Math.sin(Geometry.toRad(Math.floor(angle)))
        }
    }

    /**
     * adds the resulting movement vector to the start position
     *
     * @param start Position to move from
     * @param speed speed to move with
     * @param angle angle to move at
     * @returns {{x: number, y: number}}
     */
    static positionNextTick(start, speed, angle) {
        const speedVector = Simulation.toVector(speed, angle);

        return {
            x: start.x + speedVector.x,
            y: start.y + speedVector.y
        }
    }

    /**
     * find the entity in entities which is nearest to start.
     * the start itself will be excluded from the list if it is present.
     *
     * @param entities entities to search in
     * @param start entity to search from
     */
    static nearestEntity(entities, start) {
        return entities
            .filter(entity => entity !== start)
            .reduce((acc, entity) => {
                const dist = Geometry.distance(start, entity);
                return dist < acc[0] ? [dist, entity] : acc;
            }, [Infinity, null])
            [1];
    }

    /**
     * calculate how many ticks it will take a planet to produce the next ship.
     * the current production value and the number of docked ships are used for the calculation.
     *
     * @param planet planet to calculate for
     * @returns {number} number of ticks
     */
    static turnsTillNextShip(planet) {
        return (72 - planet.currentProduction) / (planet.numberOfDockedShips * constants.BASE_PRODUCTIVITY);
    }
}

module.exports = Simulation;