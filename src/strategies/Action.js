const constants = require('../hlt/Constants');
const Geometry = require('../hlt/Geometry');

class Action {
    constructor(score, type, data) {
        this.score = score;
        this.type = type;
        this.data = data;
    }

    execute(ship) {
        if (this.type === "spread") {
            if (ship.canDock(this.data)) {
                return ship.dock(this.data);
            } else {
                return navigatePlanet(ship, this.data);
            }
        } else if (this.type === "attack") {
            return navigateAttack(ship, this.data);
        }
    }
}

function navigateAttack(ship, attackPos) {
    const distance = Geometry.distance(ship, attackPos);
    const speed = distance < 30 ? constants.MAX_SPEED / 2 : constants.MAX_SPEED;
    return ship.navigate({
        target: attackPos,
        speed,
        avoidObstacles: true,
        ignoreShips: false
    })
}


function navigatePlanet(ship, planet) {
    const distance = Geometry.distance(ship, planet);
    const speed = distance < 30 ? constants.MAX_SPEED / 2 : constants.MAX_SPEED;
    return ship.navigate({
        target: planet,
        keepDistanceToTarget: planet.radius + constants.DOCK_RADIUS,
        speed,
        avoidObstacles: true,
        ignoreShips: false
    });
}

module.exports = Action;