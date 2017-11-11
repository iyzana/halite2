const log = require('../../hlt/Log');
const DockingGoal = require('./DockingGoal');
const AttackGoal = require('./AttackGoal');
const DefenseGoal = require('./DefenseGoal');
const ShipIntents = require('./ShipIntents');
const GoalIntent = require('./GoalIntent');

function getActions(gameMap) {
    const goals = identifyGoals(gameMap);

    const ratedGoals = rateGoals(goals);

    const requests = calcShipRequests(gameMap, ratedGoals);

    const grantedShips = magicLoop(requests);

    return grantedShips.flatMap(({goal, ships}) => goal.getShipCommands(gameMap, ships))
}

function identifyGoals(gameMap) {
    const planetGoals = gameMap.planets
        .filter(planet => (planet.isOwnedByMe() && planet.freeDockingSpots > 0) || planet.isFree())
        .map(planet => new DockingGoal(planet));

    const defenseGoals = gameMap.planets
        .filter(planet => planet.isOwnedByMe())
        .map(planet => new DefenseGoal(planet));

    const attackGoals = gameMap.enemyShips.map(ship => new AttackGoal(ship));

    return [...planetGoals, ...defenseGoals, ...attackGoals];
}

function rateGoals(goals) {
    goals.forEach(goal => goal.score = 1.0);

    return goals;
}

function calcShipRequests(gameMap, goals) {
    // groupBy implementation stringifies keys :(
    return goals
        .flatMap(goal => goal.shipRequests(gameMap))
        .groupBy(shipRequest => shipRequest.ship)
        .map(entry => new ShipIntents(entry.key, entry.values));
}

function magicLoop(shipIntents) {
    // TODO: do magic stuff to assign ships to goals based on effectiveness

    // groupBy implementation stringifies keys :(
    return shipIntents
        .map(({ship, intents}) => {
            intents.sort((a, b) => b.score - a.score);
            return {ship, goal: intents[0].goal};
        })
        .groupBy(entry => entry.goal)
        .map(({key, values}) => ({goal: key, ships: values.map(entry => entry.ship)}))
}


module.exports = {getActions};