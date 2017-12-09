const log = require('../../hlt/Log');
const ActionThrust = require("../ActionThrust");
const Geometry = require("../../hlt/Geometry");
const Simulation = require("../Simulation");
const constants = require("../../hlt/Constants");
const GoalIntent = require('./GoalIntent');
const {findPath} = require("../LineNavigation");

class HarassmentGoal {
    constructor(gameMap, player) {
        this.player = player;
    }

    shipRequests(gameMap) {
        const enemies = gameMap
            .playerShips(this.player);

        const potentialShips = gameMap.myShips.filter(ship => ship.isUndocked());

        if (potentialShips.length === 0)
            return [];

        const destination = Geometry.averagePos(enemies);
        const {entity: theChosenOne} = Simulation.nearestEntity(potentialShips, destination);

        log.log("requested ship for harassment " + theChosenOne);

        const score = 1 - Geometry.distance(theChosenOne, destination) / gameMap.maxDistance;

        return [new GoalIntent(theChosenOne, this, score)];
    }

    effectivenessPerShip(shipSet) {
        return 1;
    }

    getShipCommands(gameMap, ships) {
        const ship = ships[0];
        if (!ship) {
            return [];
        }

        log.log("harassing with ship: " + ship);
        const dockedEnemies = gameMap
            .playerShips(this.player)
            .filter(ship => ship.isDocked() || ship.isDocking());

        const sortedTargets = dockedEnemies
            .map(e => [Geometry.distance(e, ship), e])
            .sort((a, b) => a[0] - b[0])
            .map(e => e[1]);

        let target = sortedTargets[0];

        if(!target) {
            target = Simulation.nearestEntity(gameMap.playerShips(this.player), ship).entity;
        }

        log.log("target is: " + target);

        const enemies = gameMap.enemyShips
            .filter(enemy => enemy.isUndocked())
            .filter(enemy => Geometry.distance(enemy, ship) < constants.MAX_SPEED + constants.WEAPON_RADIUS + 2 * constants.SHIP_RADIUS + 1);

        const obstacles = enemies.map(enemy => ({x: enemy.x, y: enemy.y, radius: constants.MAX_SPEED + constants.WEAPON_RADIUS + constants.SHIP_RADIUS * 2}));

        const targetPos = Geometry.reduceEnd(ship, target, 2);
        const action = findPath(gameMap, ship, targetPos, targetPos, 0, obstacles);

        const attackingEnemies = enemies.filter(enemy => Geometry.distance(enemy, ship) < constants.WEAPON_RADIUS + 2 * constants.SHIP_RADIUS + 1);

        if (!action || attackingEnemies.length > 1) {
            log.log("retreating");
            const theirPos = Geometry.averagePos(enemies);

            const vector = Geometry.normalizeVector({
                x: ship.x - theirPos.x,
                y: ship.y - theirPos.y,
            });

            const retreatPoint = {
                x: theirPos.x + vector.x * 19,
                y: theirPos.y + vector.y * 19,
            };

            const {speed, angle} = findPath(gameMap, ship, retreatPoint);
            return [new ActionThrust(ship, speed, angle)];
        }

        return [new ActionThrust(ship, action.speed, action.angle)];
    }

    toString() {
        return "harassment->" + this.player;
    }
}

module.exports = HarassmentGoal;