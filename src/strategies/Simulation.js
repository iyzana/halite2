const Geometry = require('../hlt/Geometry');

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
}

module.exports = Simulation;