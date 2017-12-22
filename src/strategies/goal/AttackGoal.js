const log = require('../../hlt/Log');
const ActionThrust = require("../ActionThrust");
const Geometry = require("../../hlt/Geometry");
const Simulation = require("../Simulation");
const constants = require("../../hlt/Constants");
const GoalIntent = require('./GoalIntent');
const {findPath} = require("../LineNavigation");

class AttackGoal {
    constructor(gameMap, enemy) {
        this.enemy = enemy;

        if (this.enemy.isDocked()) {
            this.dockedAt = Simulation.nearestEntity(gameMap.planets, this.enemy).entity;
            this.nextShip = Simulation.turnsTillNextShip(this.dockedAt);
        }
    }

    shipRequests(gameMap) {
        return gameMap.myShips
            .filter(ship => ship.isUndocked())
            .map(ship => {
                let score = 1 - Math.floor(Geometry.distance(ship, this.enemy) / constants.MAX_SPEED) * constants.MAX_SPEED / gameMap.maxDistance;
                return new GoalIntent(ship, this, score);
            })
    }

    effectivenessPerShip(gameMap, shipSet) {
        const enemies = gameMap.enemyShips
            .filter(enemy => Geometry.distance(this.enemy, enemy) < constants.EFFECTIVE_ATTACK_RADIUS + 4);

        return Math.ceil(enemies.length * 1.2);
    }

    getShipCommands(gameMap, ships) {
        const enemies = gameMap.enemyShips
            .filter(enemy => enemy.isUndocked())
            .filter(enemy => Geometry.distance(this.enemy, enemy) < constants.EFFECTIVE_ATTACK_RADIUS + 4);

        const closestShip = Simulation.nearestEntity(ships, this.enemy).entity;

        const ourBunch = gameMap.myShips
            .filter(ship => ship.isUndocked())
            .filter(ship => Geometry.distance(closestShip, ship) < constants.EFFECTIVE_ATTACK_RADIUS + 4);

        if (ourBunch.length <= enemies.length) {
            log.log('running away with ships: ' + ships);

            const obstacles = gameMap.enemyShips.map(enemy => ({
                x: enemy.x,
                y: enemy.y,
                radius: constants.NEXT_TICK_ATTACK_RADIUS
            }));

            return ships.map(ship => {
                const theirClosestShip = Simulation.nearestEntity(enemies, ship).entity;
                const vector = Geometry.normalizeVector({
                    x: ship.x - theirClosestShip.x,
                    y: ship.y - theirClosestShip.y,
                });

                const escapePadding = gameMap.numberOfPlayers === 2 ? 1 : 3;
                const escapeDistance = constants.NEXT_TICK_ATTACK_RADIUS + constants.SHIP_RADIUS + escapePadding;
                const retreatPoint = {
                    x: theirClosestShip.x + vector.x * escapeDistance,
                    y: theirClosestShip.y + vector.y * escapeDistance,
                };
                return AttackGoal.navigateRetreat(gameMap, ship, retreatPoint, obstacles);
            });
        }

        return AttackGoal.navigateAttack(gameMap, ships, this.enemy);
    }

    toString() {
        return "attack->" + this.enemy;
    }

    static navigateAttack(gameMap, ships, enemy) {
        const tupleString = (t) => {
            const first = `{${t.ship.toString()}, to:[${t.to.x}, ${t.to.y}], turns:${t.turns}`;
            const intersection = t.intersections ? ", i: " + JSON.stringify(t.intersections) : "";
            return first + intersection + "}";
        };

        const attackDistance = enemy.isUndocked() ? 0 : constants.WEAPON_RADIUS + constants.SHIP_RADIUS * 2 - 1;
        let tuples = ships.map(ship => {
            const to = Geometry.reduceEnd(ship, enemy, attackDistance);
            const dist = Geometry.distance(ship, to);
            const turns = Math.floor(dist / constants.MAX_SPEED);
            return {ship, to, turns, dist};
        }).sort((a, b) => a.dist - b.dist);

        if (!enemy.isUndocked() || tuples.length < 2 || tuples[1].dist - tuples[0].dist < constants.WEAPON_RADIUS + constants.SHIP_RADIUS * 2) {
            //the two closest ships can reach the enemy in the same number of turns or the enemy is docked
            return tuples.map(t => {
                const {speed, angle} = findPath(gameMap, t.ship, t.to);
                return new ActionThrust(t.ship, speed, angle);
            });
        } else {
            log.log("attack->" + enemy);
            log.log("grouping with ships: " + ships);
            //we should group first
            const groupingCommands = [];

            //TODO better grouping

            const enemyCircle = {
                x: enemy.x,
                y: enemy.y,
                radius: constants.NEXT_TICK_ATTACK_RADIUS
            };

            const enemies = gameMap.enemyShips
                .filter(e => e.isUndocked())
                .filter(e => e !== enemy)
                .filter(e => Geometry.distance(enemy, e) < constants.EFFECTIVE_ATTACK_RADIUS);

            log.log("enemies: " + enemies);

            const intersections = enemies
                .map(e => ({x: e.x, y: e.y, radius: constants.NEXT_TICK_ATTACK_RADIUS}))
                .map(c => Geometry.intersectCircles(enemyCircle, c))
                .map(i => i.length === 2 ? [i[1], i[0]] : i)
                .map(i => i.map(pos => Geometry.angleInDegree(enemy, pos)))
                .map(interval => {
                    if (interval.length === 1)
                        return {start: interval[0], end: interval[0]};
                    else
                        return {start: interval[0], end: interval[1]};
                })
                .map(i => ({start: Math.ceil(i.start), end: Math.floor(i.end)}));

            log.log("intersections: " + JSON.stringify(intersections));

            tuples
                .filter(t => t.dist > enemyCircle.radius + constants.MAX_SPEED + constants.SHIP_RADIUS)
                .forEach(tuple => {
                    //just fly to attack target and avoid other enemies
                    log.log(tuple.ship + " just flying to target");
                    const {speed, angle} = findPath(gameMap, tuple.ship, enemy, enemy, 0, enemies);
                    groupingCommands.push(new ActionThrust(tuple.ship, speed, angle));
                });

            tuples = tuples.filter(t => t.dist <= enemyCircle.radius + constants.MAX_SPEED + constants.SHIP_RADIUS);

            const tupleIntersections = tuples
                .map(t => ({
                    x: t.ship.x,
                    y: t.ship.y,
                    radius: constants.MAX_SPEED + constants.SHIP_RADIUS
                }))
                .map(c => Geometry.intersectCircles(c, enemyCircle))
                .map(i => i.map(pos => Geometry.angleInDegree(enemy, pos)))
                .map(interval => {
                    if (interval.length === 0)
                        return [];
                    else if (interval.length === 1)
                        return [{start: Math.ceil(interval[0]), end: Math.floor(interval[0])}];
                    else
                        return [{start: Math.ceil(interval[0]), end: Math.floor(interval[1])}];
                })
                .map(i => intersections.length === 0 ? i : Geometry.angleIntervalIntersections(intersections.concat(i)));

            //dirty hack //TODO: do this in some better way
            tuples.forEach((tuple, index) => {
                tuple.intersections = tupleIntersections[index];
            });

            log.log("tupleIntersections" + tuples.map(tupleString));

            tuples
                .filter(t => t.intersections.length === 0)
                .forEach(t => {
                    log.log(t.ship + " inside some enemy...navigating to target");
                    //we are inside some enemy
                    const {speed, angle} = findPath(gameMap, t.ship, enemy, enemy, 0, enemies);
                    groupingCommands.push(new ActionThrust(t.ship, speed, angle));
                });
            tuples = tuples.filter(t => t.intersections.length !== 0);

            const groups = [];

            tuples.forEach(t => {
                let groupFound = false;
                groups.forEach(g => {
                    if (!groupFound) {
                        const intersection = Geometry.angleIntervalIntersections([g.intersection].concat(t.intersections));
                        if (intersection.length > 0) {
                            g.intersection = intersection[0];
                            g.tuples.push(t);
                            groupFound = true;
                        }
                    }
                });

                if (!groupFound) {
                    groups.push({
                        intersection: t.intersections[0],
                        tuples: [t],
                    });
                }
            });

            groups.forEach(g => {
                log.log("g=int: " + JSON.stringify(g.intersection) + ", t:" + g.tuples.map(tupleString));
                const groupingAngle = Geometry.averageAngle(g.intersection.start, g.intersection.end);
                log.log("angle: " + groupingAngle);

                const initalGroupingPosition = {
                    x: enemy.x + constants.NEXT_TICK_ATTACK_RADIUS * Math.cos(Geometry.toRad(groupingAngle)),
                    y: enemy.y + constants.NEXT_TICK_ATTACK_RADIUS * Math.sin(Geometry.toRad(groupingAngle)),
                    radius: 1,
                };

                log.log(`pos: [${initalGroupingPosition.x}, ${initalGroupingPosition.y}]`);

                const groupingPositions = [initalGroupingPosition];
                let i = 0;
                while (groupingPositions.length < g.tuples.length) {
                    i++;
                    if (i > 5) break;

                    if (groupingPositions.length === 1) {
                        const newPositions = Geometry.intersectCircles(initalGroupingPosition, enemyCircle);
                        newPositions.forEach(p => {
                            p.radius = 1;
                        });
                        groupingPositions.concat(newPositions);
                        continue;
                    }

                    const generateFrom = groupingPositions[groupingPositions.length - 2];
                    const intersections = Geometry.intersectCircles(generateFrom, enemyCircle);
                    intersections.forEach(i => {
                        i.radius = 1;
                        if (!groupingPositions.some(p => p.x === i.x && p.y === i.y)) {
                            groupingPositions.push(i);
                        }
                    });

                }

                groupingPositions.forEach((p, i) => log.log(`pos(${i}): [${p.x}, ${p.y}]`));

                g.tuples.forEach(t => {
                    let minDistance = Infinity;
                    let minPosition;
                    groupingPositions.forEach(pos => {
                        const dist = Geometry.distance(pos, t.ship);
                        if (dist < minDistance) {
                            minDistance = dist;
                            minPosition = pos;
                        }
                    });
                    const {speed, angle} = findPath(gameMap, t.ship, initalGroupingPosition);
                    groupingCommands.push(new ActionThrust(t.ship, speed, angle));
                });
            });

            return groupingCommands;
        }
    }

    static navigateRetreat(gameMap, ship, retreatPoint, obstacles) {
        const to = Geometry.reduceEnd(ship, retreatPoint, 0.5);
        const {speed, angle} = findPath(gameMap, ship, to, to, 0, obstacles);
        return new ActionThrust(ship, speed, angle);
    }
}

module.exports = AttackGoal;