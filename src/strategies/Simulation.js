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

    static intersectWallsWithCircle(gameMap, circle) {
        const rSq = circle.radius ** 2;

        //TODO why is this so ugly?!? jannis help!
        const intersections = [];

        //top
        let discriminant = rSq - circle.y ** 2;
        if (discriminant >= 0) {
            discriminant = Math.sqrt(discriminant);
            intersections.push([{
                x: circle.x + discriminant,
                y: 0,
            }, {
                x: circle.x - discriminant,
                y: 0,
            }]);
        }

        //right
        discriminant = rSq - (gameMap.width - circle.x) ** 2;
        if (discriminant >= 0) {
            discriminant = Math.sqrt(discriminant);
            intersections.push([{
                x: gameMap.width,
                y: circle.y + discriminant,
            }, {
                x: gameMap.width,
                y: circle.y - discriminant,
            }]);
        }


        //bottom
        discriminant = rSq - (gameMap.height - circle.y) ** 2;
        if (discriminant >= 0) {
            discriminant = Math.sqrt(discriminant);
            intersections.push([{
                x: circle.x + discriminant,
                y: gameMap.height,
            }, {
                x: circle.x - discriminant,
                y: gameMap.height,
            }]);
        }

        //left
        discriminant = rSq - circle.x ** 2;
        if (discriminant >= 0) {
            discriminant = Math.sqrt(discriminant);
            intersections.push([{
                x: 0,
                y: circle.y + discriminant,
            }, {
                x: 0,
                y: circle.y - discriminant,
            }]);
        }


        return intersections;
    }


    static insideWall(gameMap, pos) {
        return pos.x < 0 || pos.y < 0 || pos.x >= gameMap.width || pos.y >= gameMap.height;
    }

    static getWallEscape(gameMap, pos, target, thrust) {
        if (!Simulation.insideWall(gameMap, target))
            return target;

        const rs = [{x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 0, y: -1}];

        // walls from top clockwise
        let wallEscapes = [];
        for (let i = 0; i < 4; i++) {
            const o = {
                x: i === 1 ? gameMap.width : 0,
                y: i === 2 ? gameMap.height : 0,
            };

            wallEscapes = wallEscapes.concat(Simulation.getWallEscapesInternal(rs[i], o, pos, thrust));
        }
        if (wallEscapes.length === 2) {
            const [pos1, pos2] = wallEscapes;
            log.log(`pos: ${pos}, target: ${target.x},${target.y}, escapes: [${pos1.x},${pos1.y}],[${pos2.x},${pos2.y}]]`);
            return Geometry.distance(target, pos1) < Geometry.distance(target, pos2) ? pos1 : pos2;
        }
        log.log('corner case: ' + wallEscapes.length);
        log.log(`pos: ${pos}, target: ${target.x},${target.y}, thrust: ${thrust}`);
        wallEscapes.forEach(e => log.log(`wallEscapes: [${e.x},${e.y}]`));
        const [pos1, pos2] = wallEscapes
            .filter(escape => !Simulation.insideWall(gameMap, escape));

        if (pos1 === undefined || pos2 === undefined) {
            log.log('escape points inside wall!!');
            return {x: 1, y: 0};
        }

        log.log(`pos: ${pos}, target: ${target.x},${target.y}, escapes: [[${pos1.x},${pos1.y}],[${pos2.x},${pos2.y}]]`);
        return Geometry.distance(target, pos1) < Geometry.distance(target, pos2) ? pos1 : pos2;
    }

    static getWallEscapesInternal(r, o, s, t) {
        const a = r.x ** 2 + r.y ** 2;
        const b = r.x * (o.x - s.x) + r.y * (o.y - s.y);
        const e = b ** 2 - a * ((o.x - s.x) ** 2 + (o.y - s.y) ** 2 - t ** 2);

        log.log(`a: ${a}, b: ${b}, e: ${e}`);

        if (e < 0)
            return [];

        const root = 2 * Math.sqrt(e);

        const d1 = (-b + root) / a;
        const d2 = (-b - root) / a;

        log.log(`d1: ${d1}, d2: ${d2}`);

        return [{
            x: r.x * d1 + o.x - 2 * r.y,
            y: r.y * d1 + o.y + 2 * r.x
        }, {
            x: r.x * d2 + o.x - 2 * r.y,
            y: r.y * d2 + o.y + 2 * r.x
        }];
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
        let ships = planet.dockedShips
            .filter(ship => !ship.isUndocking())
            .map(ship => ({status: ship.dockingStatus, progress: ship.dockingProgress}));

        if (ships.length === 0)
            return Infinity;

        let turns = 0;
        let currentProd = planet.currentProduction;

        while (currentProd < 72) {
            const dockedShips = ships.filter(ship => ship.status === dockingStatus.DOCKED).length;
            currentProd += this.productionWithShips(dockedShips);

            this.updateDockStates(ships);

            turns++;
        }

        return turns;
    }

    static turnsTillFull(planet) {
        let ships = planet.dockedShips
            .filter(ship => !ship.isUndocking())
            .map(ship => ({status: ship.dockingStatus, progress: ship.dockingProgress}));

        if (ships.length === 0)
            return Infinity;

        let turns = 0;
        let currentProd = planet.currentProduction;

        while (planet.dockingSpots > ships.length) {
            let dockedShips = ships.filter(ship => ship.status === dockingStatus.DOCKED).length;
            currentProd += Simulation.productionWithShips(dockedShips);

            this.updateDockStates(ships);

            if (currentProd >= 72) {
                ships.push({status: dockingStatus.UNDOCKED, progress: 5});
                currentProd -= 72;
            }

            turns++;
        }

        return turns - 1;
    }

    static shipsInTurns(planet, turns) {
        let ships = planet.dockedShips
            .filter(ship => !ship.isUndocking())
            .map(ship => ({status: ship.dockingStatus, progress: ship.dockingProgress}));

        if (ships.length === 0)
            return 0;

        let currentProd = planet.currentProduction;
        let newShips = 0;

        while (turns > 0) {
            const dockedShips = ships.filter(ship => ship.status === dockingStatus.DOCKED).length;
            currentProd += this.productionWithShips(dockedShips);

            this.updateDockStates(ships);

            if (currentProd >= 72) {
                newShips++;
                currentProd -= 72;
            }

            turns--;
        }

        return newShips;
    }

    static updateDockStates(ships) {
        ships.forEach(ship => {
            if (ship.status === dockingStatus.UNDOCKED)
                ship.status = dockingStatus.DOCKING;
            else if (ship.status === dockingStatus.DOCKING) {
                ship.progress--;

                if (ship.progress === 0)
                    ship.status = dockingStatus.DOCKED;
            }
        });
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