const Geometry = require('../hlt/Geometry');
const constants = require('../hlt/Constants');

class Simulation {
    static toVector(speed, angle) {
        return {
            x: Math.floor(speed) * Math.cos(Geometry.toRad(Math.floor(angle))),
            y: Math.floor(speed) * Math.sin(Geometry.toRad(Math.floor(angle)))
        }
    }

    static positionNextTick(start, speed, angle) {
        const speedVector = Simulation.toVector(speed, angle);

        return {
            x: start.x + speedVector.x,
            y: start.y + speedVector.y
        }
    }

    static nearestEntity(entities, start) {
        const [_, entity] = entities.reduce((acc, entity) => {
            const dist = Geometry.distance(start, entity);
            return dist < acc[0] ? [dist, entity] : acc;
        }, [Infinity, null]);

        return entity;
    }

    static turnsTillNextShip(planet) {
        return (72 - planet.currentProduction) / (planet.numberOfDockedShips * constants.BASE_PRODUCTIVITY);
    }
}

module.exports = Simulation;