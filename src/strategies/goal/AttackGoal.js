const log = require('../../hlt/Log');
const ActionThrust = require("../ActionThrust");
const Geometry = require("../../hlt/Geometry");
const Simulation = require("../Simulation");
const constants = require("../../hlt/Constants");
const GoalIntent = require('./GoalIntent');
const {findPath} = require("../LineNavigation");

const GROUPING_RADIUS = constants.EFFECTIVE_ATTACK_RADIUS + 4;

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
            .map(ship => new GoalIntent(ship, this, 1 - Geometry.distance(ship, this.enemy) / gameMap.maxDistance));
    }

    effectivenessPerShip(gameMap, shipSet) {
        const enemies = gameMap.enemyShips
            .filter(enemy => Geometry.distance(this.enemy, enemy) < GROUPING_RADIUS);

        if (enemies.length === 1)
            return 1;
        return Math.min(15, Math.ceil(enemies.length * 1.2));
    }

    getShipCommands(gameMap, ships, grantedShips) {
        //if we attack a docked enemy it is not in the list(potential empty list)
        //this is intentional
        const enemies = gameMap.enemyShips
            .filter(enemy => enemy.isUndocked())
            .filter(enemy => Geometry.distance(this.enemy, enemy) < GROUPING_RADIUS);

        const closestShip = Simulation.nearestEntity(ships, this.enemy).entity;

        const ourBunch = enemies
            .concat(this.enemy.isUndocked() ? [] : [this.enemy])
            .flatMap(e => {
                const grantedShip = grantedShips.find(({goal}) => goal instanceof AttackGoal && goal.enemy === e);
                if (grantedShip) {
                    return grantedShip.ships;
                }
                return [];
            })
            .filter(ship => Geometry.distance(closestShip, ship) < GROUPING_RADIUS);

        const ourHealth = ourBunch.reduce((acc, c) => acc + c.health, 0);
        const enemyHealth = enemies.reduce((acc, c) => acc + c.health, 0);

        const lessShips = ourBunch.length < enemies.length;
        const lessHealth = ourHealth <= enemyHealth && ourBunch.length === enemies.length;
        if (lessShips || lessHealth) {
            const theirClosestShip = Simulation.nearestEntity(enemies, closestShip).entity;

            // only running away when close
            if (Geometry.distance(closestShip, theirClosestShip) < constants.MAX_SPEED + constants.NEXT_TICK_ATTACK_RADIUS) {
                const vector = Geometry.normalizeVector({
                    x: closestShip.x - theirClosestShip.x,
                    y: closestShip.y - theirClosestShip.y,
                });

                const escapePadding = gameMap.numberOfPlayers === 2 ? 1 : 3;
                const escapeDistance = constants.NEXT_TICK_ATTACK_RADIUS + constants.SHIP_RADIUS + escapePadding;
                const retreatPoint = {
                    x: theirClosestShip.x + vector.x * escapeDistance,
                    y: theirClosestShip.y + vector.y * escapeDistance,
                };

                log.log('running away with ships: ' + ships);

                let obstacles = gameMap.enemyShips
                    .filter(ship => ship.isUndocked())
                    .map(enemy => ({x: enemy.x, y: enemy.y, radius: constants.NEXT_TICK_ATTACK_RADIUS}));

                if(ships.length !== 1)
                    obstacles = [];

                return ships.map(ship => AttackGoal.navigateRetreat(gameMap, ship, retreatPoint, obstacles));
            }
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

        const attackDistance = enemy.isUndocked() ? 0 : constants.EFFECTIVE_ATTACK_RADIUS - 1;
        let tuples = ships.map(ship => {
            let to = Geometry.reduceEnd(ship, enemy, attackDistance);
            const dist = Geometry.distance(ship, to);
            const turns = Math.floor(dist / constants.MAX_SPEED);
            const angle = Geometry.angleInDegree(enemy, ship);

            if(!enemy.isUndocked()) {
                const dockedPlanet = gameMap.planets.find(p => p.id === enemy.dockedPlanetId);
                const shipSpawnPoint = dockedPlanet.calcShipSpawnPoint();
                let bestAttackPosition = {
                    x: enemy.x - shipSpawnPoint.x,
                    y: enemy.y - shipSpawnPoint.y,
                };

                bestAttackPosition = Geometry.normalizeVector(bestAttackPosition);
                bestAttackPosition = {
                    x: enemy.x + bestAttackPosition.x * constants.WEAPON_RADIUS,
                    y: enemy.y + bestAttackPosition.y * constants.WEAPON_RADIUS,
                };

                to = bestAttackPosition;
            }

            return {ship, to, turns, dist, angle};
        }).sort((a, b) => a.dist - b.dist);

        if (!enemy.isUndocked() || tuples.length < 2 || tuples[1].dist - tuples[0].dist < constants.NEXT_TICK_ATTACK_RADIUS) {
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

            let intersections = enemies
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

            const planetIntersections = gameMap.planets
                .filter(p => Geometry.distance(p, enemyCircle) <= p.radius + enemyCircle.radius)
                .map(p => Geometry.intersectCircles({x: p.x, y: p.y, radius: p.radius + constants.SHIP_RADIUS}, enemyCircle))
                .map(i => i.map(pos => Geometry.angleInDegree(enemyCircle, pos)))
                .map(interval => {
                    if (interval.length === 1)
                        return {start: interval[0], end: interval[0]};
                    else
                        return {start: interval[0], end: interval[1]};
                })
                .map(i => ({start: Math.ceil(i.start), end: Math.floor(i.end)}));

            if(intersections.length !== 0 && planetIntersections.length !== 0)
            intersections = Geometry.angleIntervalIntersections(planetIntersections.concat(intersections));

            log.log("intersections: " + JSON.stringify(intersections));

            tuples
                .filter(t => t.dist > enemyCircle.radius + constants.MAX_SPEED + constants.SHIP_RADIUS)
                .forEach(tuple => {
                    //just fly to attack target and avoid other enemies
                    log.log(tuple.ship + " just flying to target");
                    const {speed, angle} = findPath(gameMap, tuple.ship, enemy, enemies);
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
                    const {speed, angle} = findPath(gameMap, t.ship, enemy, enemies);
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

                g.tuples.sort((a,b) => Geometry.angleBetween(groupingAngle, a) - Geometry.angleBetween(groupingAngle, b));

                const discreteGroupingPositions = [];
                for(let i = 0; i < g.tuples.length; i++) {
                    const groupingPositions = this.genGroupingPositions(groupingAngle, enemyCircle, g.tuples.length, discreteGroupingPositions);

                    const index = groupingPositions
                        .sort((a, b) => a.angle - b.angle)
                        .findIndex((pos) => pos.index === i);

                    const ship = g.tuples[index].ship;
                    const to = groupingPositions[index];

                    const requestedVector = Simulation.toVector(Math.max(1, Geometry.distance(ship, to)), Geometry.angleInDegree(ship, to));
                    to.x = ship.x + requestedVector.x;
                    to.y = ship.y + requestedVector.y;

                    discreteGroupingPositions.push(to);

                    const {speed, angle} = findPath(gameMap, ship, to);
                    groupingCommands.push(new ActionThrust(ship, speed, angle));
                }

                discreteGroupingPositions.forEach((p, i) => log.log(`pos(${i}): [${p.x}, ${p.y}]`));
            });

            return groupingCommands;
        }
    }

    static genGroupingPositions(groupingAngle, enemyCircle, numGen, groupingPositions) {
        if(!groupingPositions) groupingPositions = [];

        if(groupingPositions.length === 0) {
            const initialGroupingPosition = {
                x: enemyCircle.x + constants.NEXT_TICK_ATTACK_RADIUS * Math.cos(Geometry.toRad(groupingAngle)),
                y: enemyCircle.y + constants.NEXT_TICK_ATTACK_RADIUS * Math.sin(Geometry.toRad(groupingAngle)),
                radius: 1,
                index: 0,
            };

            initialGroupingPosition.angle = Geometry.angleBetween(groupingAngle, Geometry.angleInDegree(enemyCircle, initialGroupingPosition));

            log.log(`pos: [${initialGroupingPosition.x}, ${initialGroupingPosition.y}]`);

            groupingPositions = [initialGroupingPosition];
        }

        let i = groupingPositions.length - 1;
        while (groupingPositions.length < numGen) {
            i++;

            if (i % 2 === 1) {
                const generateFrom = groupingPositions[Math.max(0, i - 4)];
                const intersections = Geometry.intersectCircles(generateFrom, enemyCircle);

                let newGroupingPosition = intersections[0];
                if(!groupingPositions.find(pos => Math.abs(pos.x - intersections[1].x) < 0.00001 && Math.abs(pos.y - intersections[1].y) < 0.00001)) {
                    newGroupingPosition = intersections[1];
                }
                newGroupingPosition.radius = 1;
                newGroupingPosition.index = i;
                groupingPositions.push(newGroupingPosition);
            } else {
                const ship1 = groupingPositions[i-1];
                const ship2 = groupingPositions[Math.max(0, i-5)];

                const intersections = Geometry.intersectCircles(ship1, ship2);

                let newGroupingPosition = intersections[0];
                if(Geometry.distance(intersections[1], enemyCircle) > Geometry.distance(intersections[0], enemyCircle)) {
                    newGroupingPosition = intersections[1];
                }
                newGroupingPosition.radius = 1;
                newGroupingPosition.index = i;
                newGroupingPosition.angle = Geometry.angleBetween(groupingAngle, Geometry.angleInDegree(enemyCircle, newGroupingPosition));
                groupingPositions.push(newGroupingPosition);
            }
        }

        return groupingPositions;
    }

    static navigateRetreat(gameMap, ship, retreatPoint, obstacles) {
        const to = Geometry.reduceEnd(ship, retreatPoint, 0.5);
        const {speed, angle} = findPath(gameMap, ship, to, obstacles);
        return new ActionThrust(ship, speed, angle);
    }

    calculateGoalScore(gameMap) {
        const myPlanets = gameMap.planets.filter(planet => planet.isOwnedByMe());

        const distanceToPlanet = Simulation.nearestEntity(gameMap.planets, this.enemy).dist;

        // todo: try scoring by distance from enemy to closest of our planets
        if (this.enemy.isUndocked()) {
            this.score = 1.02;
        } else if (this.enemy.isUndocking()) {
            this.score = 1.045;
        } else {
            this.score = 1.04;
            const distanceToMe = Simulation.nearestEntity(myPlanets, this.enemy).dist;
            if (distanceToMe > 60) {
                this.score += 0.04;
            }
        }

        if (distanceToPlanet > 60) {
            this.score -= 2;
        }
    }
}

module.exports = AttackGoal;