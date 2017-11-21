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
        /*
        additional value is required otherwise the resulting vector sometimes has an value of .99999999999999
        which will be floored afterwards, which would lead to unwanted behaviours.
         */
        return {
            x: (Math.floor(speed) + 0.00000000001) * Math.cos(Geometry.toRad(Math.floor(angle) + 0.00000000001)),
            y: (Math.floor(speed) + 0.00000000001) * Math.sin(Geometry.toRad(Math.floor(angle) + 0.00000000001))
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

    static insideWall(gameMap, pos) {
        return pos.x < 0 || pos.y < 0 || pos.x >= gameMap.width || pos.y >= gameMap.height;
    }

    static getWallEscapes(gameMap, pos) {
        if (!Simulation.insideWall(gameMap, pos))
            return undefined;

        const sx = pos.x;
        const sy = pos.y;

        // walls from top clockwise
        for (let i = 0; i < 4; i++) {
            const rx = (i + 1) % 2;
            const ry = i % 2;

            const ox = i === 1 ? gameMap.width : 0;
            const oy = i === 2 ? gameMap.height : 0;

            const a = rx ** 2 + ry ** 2;
            const b = rx * (ox - sx) + ry * (oy - sy);
            const e = b ** 2 - a * ((ox + sx) * (oy + sy) - 49);

            if (e < 0)
                continue;

            const root = 2 * Math.sqrt(e);

            const d1 = (-b + root) / a;
            const d2 = (-b - root) / a;

            const pos1 = {
                x: rx * d1 + ox,
                y: ry * d1 + oy
            };
            const pos2 = {
                x: rx * d2 + ox,
                y: ry * d2 + oy
            };
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
                return dist < acc.dist ? {dist, entity} : acc;
            }, {dist: Infinity, entity: null});
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

    static shipsInTurns(planet, turnsLeft) {
        const tillNextShip = Simulation.turnsTillNextShip(planet);
        if (tillNextShip > turnsLeft)
            return 0;
        if (tillNextShip === turnsLeft)
            return 1;
        turnsLeft -= tillNextShip;
        return 1 + Math.floor(this.productionWithShips(planet.numberOfPlayers) * turnsLeft / 72);
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
                    return {collision: true, time: 0.0};
                }
                return {collision: false, time: 0.0};
            }
            const t = -c / b;
            if (t >= 0.0) {
                return {collision: t <= 1.0, time: t};
            }
            return {collision: false, time: 0.0};
        }
        else if (disc === 0.0) {
            // One solution
            const t = -b / (2 * a);
            return {collision: t >= 0.0 && t <= 1.0, time: t};
        }
        else if (disc > 0) {
            const t1 = -b + Math.sqrt(disc);
            const t2 = -b - Math.sqrt(disc);

            if (t1 >= 0.0 && t2 >= 0.0) {
                const time = Math.min(t1, t2) / (2 * a);
                return {collision: time >= 0.0 && time <= 1.0, time: time};
            } else if (t1 <= 0.0 && t2 <= 0.0) {
                const time = Math.max(t1, t2) / (2 * a);
                return {collision: time >= 0.0 && time <= 1.0, time: time};
            } else {
                return {collision: true, time: 0.0};
            }
        }
        else {
            return {collision: false, time: 0.0};
        }
    }
}

module.exports = Simulation;