const constants = require('../hlt/Constants');
const Geometry = require('../hlt/Geometry');
const log = require('../hlt/Log');

const Intent = require('./Intent');

let scaleTo;
let maxDistance;
let maxWeight;

function spread(gameMap, planetsOfInterest, ship, planetWeights) {
    if (!maxDistance) {
        maxDistance = Math.sqrt(Math.pow(gameMap.width, 2) + Math.pow(gameMap.height, 2));
    }

    return planetsOfInterest.map(planet => {
        const score = getPlanetScore(gameMap, ship, planet, planetWeights.get(planet));

        return new Intent(score, "spread", planet);
    });
}

function getPlanetScore(gameMap, ship, planet, weight) {
    const shipPct = (gameMap.myShips.length / gameMap.allShips.length) * 1.8; // from 1 2/3 1/2 1/4 0
    const distPct = 1 - Geometry.distance(ship, planet) / maxDistance;
    const gain = weight / maxWeight;
    return (distPct * 0.8 + gain * 0.2) * (3 - shipPct);
}

function weightPlanets(gameMap) {
    if (!scaleTo) {
        scaleTo = Math.sqrt(Math.floor(gameMap.width * gameMap.height));
    }

    let planets = gameMap.planets;

    return new Map(planets.map(planet => {
        const weight = planets
            .map(planetWeigher(planet))
            .filter(v => v > 0)
            .reduce((prev, cur) => prev + cur, 0);

        if (!maxWeight || weight > maxWeight)
            maxWeight = weight;

        return [planet, weight];
    }));
}

function planetWeigher(planet) {
    return neighbor => planet.dockingSpots * (1 - Geometry.distance(planet, neighbor) / scaleTo);
}

module.exports = {spread, weightPlanets};