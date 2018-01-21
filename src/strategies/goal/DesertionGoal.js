const ActionDock = require('../ActionDock');
const ActionThrust = require('../ActionThrust');
const Geometry = require("../../hlt/Geometry");
const Simulation = require("../Simulation");
const AttackGoal = require("./AttackGoal");
const GoalIntent = require("./GoalIntent");
const LineNavigation = require("../LineNavigation");
const log = require("../../hlt/Log");

class DesertionGoal {
    constructor(gameMap) {

    }

    shipRequests(gameMap) {
        return gameMap.myShips
            .map(s => new GoalIntent(s, this, 1));
    }

    effectivenessPerShip(gameMap) {
        return 10000;
    }

    getShipCommands(gameMap, ships) {
        log.log("deserting with " + ships.length + " ships");
        const smallestGroup = gameMap.enemyShips
            .groupBy(s => s.ownerId)
            .map(t => [t.key, t.values.length])
            .reduce((acc, c) => acc[1] < c[1] ? acc : c, [-1, Infinity]);
        log.log("smallest group: " + smallestGroup);

        const attackLower = smallestGroup[1] < gameMap.myShips.length;
        const attackEnemies = gameMap.enemyShips
            .filter(e => e.ownerId === smallestGroup[0]);

        const myDockedShips = ships.filter(s => s.isDocked());
        const myFreeShips = ships.filter(s => s.isUndocked());

        const undockActions = myDockedShips.map(s => new ActionDock(s, undefined, false));

        let freeCommands = null;
        if (attackLower) {
            const middle = Geometry.averagePos(ships);
            const closestOfThem = Simulation.nearestEntity(attackEnemies, middle).entity;

            if (Geometry.distance(middle, closestOfThem) < 200) {
                log.log("attacking enemy " + smallestGroup[0]);
                const goal = new AttackGoal(gameMap, closestOfThem);
                const granted = [{goal: goal, ships: myFreeShips}];
                freeCommands = goal.getShipCommands(gameMap, myFreeShips, granted);
            } else {
                log.log("too far away");
            }
        }

        if (freeCommands === null) {
            log.log("falling back to evading");
            const otherEnemies = gameMap.enemyShips
                .map(e => ({x: e.x, y: e.y, radius: 25}));

            freeCommands = myFreeShips.map(s => {
                const {speed, angle} = LineNavigation.findPath(gameMap, s, s, otherEnemies);
                return new ActionThrust(s, speed, angle);
            });
        }

        freeCommands = freeCommands.concat(undockActions);

        return freeCommands;
    }

    calculateGoalScore(gameMap) {
        this.score = 20;
    }
}

module.exports = DesertionGoal;