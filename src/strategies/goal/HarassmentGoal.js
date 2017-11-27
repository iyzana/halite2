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
        const dockedEnemies = gameMap
            .playerShips(this.player)
            .filter(ship => ship.isDocked() || ship.isDocking());

        const potentialShips = gameMap.myShips.filter(ship => ship.isUndocked());

        const theChosenOne = Simulation.nearestEntity(potentialShips, Geometry.averagePos(dockedEnemies));

        return [new GoalIntent(theChosenOne, this, 1)];
    }

    effectivenessPerShip(shipSet) {
        return 1;
    }

    getShipCommands(gameMap, ships) {
        const ship = ships[0];
        const dockedEnemies = gameMap
            .playerShips(this.player)
            .filter(ship => ship.isDocked() || ship.isDocking());

       const sortedTargets = dockedEnemies
           .map(e => [Geometry.distance(e, ship), e])
           .sort((a, b) => a[0] - b[0])
           .map(e => e[1]);

       const target = sortedTargets[0];

       const enemies = gameMap.enemyShips
           .filter(enemy => enemy.isUndocked())
           .filter(enemy => Geometry.distance(enemy, ship) < constants.WEAPON_RADIUS + 2*constants.SHIP_RADIUS + 1);

       const obstacles = enemies
            .map(enemy => {
               const speed = Math.min(7, Geometry.distance(enemy, ship));
               const angle = Geometry.angleInDegree(enemy, ship);

               const nextPos = Simulation.positionNextTick(enemy, speed, angle);
               nextPos.radius = constants.WEAPON_RADIUS + constants.SHIP_RADIUS;
               return nextPos;
           });

        const action = findPath(gameMap, ship, target, target, 0, obstacles);

        if (!action) {
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
            return new ActionThrust(ship, speed, angle);
        }

        return new ActionThrust(ship, speed, angle);
    }

    toString() {
        return "harassment->" + this.player;
    }
}

module.exports = HarassmentGoal;