const Geometry = require('../hlt/Geometry');
const constants = require('../hlt/Constants');
const dockingStatus = require('../hlt/DockingStatus');
const log = require('../hlt/Log');

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


    static productionWithShips(count) {
        return count * constants.BASE_PRODUCTIVITY;
    }

    /**
     * calculate how many ticks it will take a planet to produce the next ship.
     * the current production value and the number of docked ships are used for the calculation.
     *
     * @param planet planet to calculate for
     * @returns {number} number of ticks
     */
    static turnsTillNextShip(planet) {
        return (72 - planet.currentProduction) / this.productionWithShips(planet.numberOfDockedShips);
    }

    static turnsTillFullHeuristic(planet) {
        let ships = (planet.numberOfDockedShips * 2 + planet.dockingSpots) / 3;

        return (72 * (planet.freeDockingSpots - 1) + 72 - planet.currentProduction) / this.productionWithShips(ships) * 1.5;
    }

    static turnsTillFull(gameMap, planet) {
        let ships = gameMap.myShips
            .filter(ship => ship.isDocked() || ship.isDocking())
            .filter(ship => Geometry.distance(ship, planet) < planet.radius + constants.DOCK_RADIUS)
            .map(ship => ({status: ship.dockingStatus, progress: ship.dockingProgress}));

        if (ships.length === 0)
            return Infinity;

        let turns = 0;
        let currentProduction = planet.currentProduction;

        while (planet.dockingSpots > ships.length) {
            let dockedShips = ships.filter(ship => ship.status === dockingStatus.DOCKED);
            currentProduction += Simulation.productionWithShips(dockedShips.length);

            ships.forEach(ship => {
                if (ship.status === dockingStatus.UNDOCKED)
                    ship.status = dockingStatus.DOCKING;
                else if (ship.status === dockingStatus.DOCKING) {
                    ship.progress--;

                    if (ship.progress === 0)
                        ship.status = dockingStatus.DOCKED;
                }
            });

            if (currentProduction >= 72) {
                ships.push({status: dockingStatus.UNDOCKED, progress: 5});
                currentProduction = 0;
            }

            turns++;
        }

        return turns - 1;
    }

    static turnsTillEntityReached(ship, entity) {
        const position = Geometry.reduceEnd(ship, entity, entity.radius);
        return Simulation.turnsTillPositionReached(ship, position);
    }

    static turnsTillPositionReached(ship, position) {
        return Geometry.distance(ship, position) / constants.MAX_SPEED;
    }

    // ported to js from the halite game-engine source code
    static collisionTime(radius, pos1, pos2, thrust1, thrust2) {
        // With credit to Ben Spector
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dvx = thrust1.x - thrust2.x;
        const dvy = thrust1.y - thrust2.y;

        // Quadratic formula
        const a = Math.pow(dvx, 2) + Math.pow(dvy, 2);
        const b = 2 * (dx * dvx + dy * dvy);
        const c = Math.pow(dx, 2) + Math.pow(dy, 2) - Math.pow(radius, 2);

        const disc = Math.pow(b, 2) - 4 * a * c;

        if (a === 0.0) {
            if (b === 0.0) {
                if (c <= 0.0) {
                    // Implies r^2 >= dx^2 + dy^2 and the two are already colliding
                    return { collision: true, time: 0.0 };
                }
                return { collision: false, time: 0.0 };
            }
            const t = -c / b;
            if (t >= 0.0) {
                return { collision: true, time: t };
            }
            return { collision: false, time: 0.0 };
        }
        else if (disc === 0.0) {
            // One solution
            const t = -b / (2 * a);
            return { collision: true, time: t };
        }
        else if (disc > 0) {
            const t1 = -b + Math.sqrt(disc);
            const t2 = -b - Math.sqrt(disc);

            if (t1 >= 0.0 && t2 >= 0.0) {
                return { collision: true, time: Math.min(t1, t2) / (2 * a) };
            } else if (t1 <= 0.0 && t2 <= 0.0) {
                return { collision: true, time: Math.max(t1, t2) / (2 * a) };
            } else {
                return { collision: true, time: 0.0 };
            }
        }
        else {
            return { collision: false, time: 0.0 };
        }
    }
}

module.exports = Simulation;