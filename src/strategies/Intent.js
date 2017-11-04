const constants = require('../hlt/Constants');
const Geometry = require('../hlt/Geometry');
const {findPath} = require('./LineNavigation');
const log = require('../hlt/Log');

class Intent {
    constructor(score, type, data) {
        this.score = score;
        this.type = type;
        this.data = data;
    }

    /**
     * get the action necessary to execute this intent
     *
     * @param gameMap The map
     * @param ship The ship to execute it for
     * @returns {[string, *, *]}
     */
    getAction(gameMap, ship) {
        if (this.type === "spread") {
            if (ship.canDock(this.data)) {
                return ["dock", this.data];
            } else {
                return this.navigatePlanet(gameMap, ship);
            }
        } else if (this.type === "attack") {
            return this.navigateAttack(gameMap, ship);
        }
    }

    navigatePlanet(gameMap, ship) {
        const to = Geometry.reduceEnd(ship, this.data, this.data.radius + constants.DOCK_RADIUS);
        const {speed, angle} = findPath(gameMap, ship, to);
        return ["thrust", speed, angle];
    }

    navigateAttack(gameMap, ship) {
        const {speed, angle} = findPath(gameMap, ship, this.data);
        return ["thrust", speed, angle];
    }

    toString() {
        const roundedScore = (Math.round(this.score * 100) / 100);

        if (this.type === "attack") {
            return roundedScore + "#" + this.type + '->[' + Math.floor(this.data.x) + "," + Math.floor(this.data.y) + "]";
        }

        return roundedScore + "#" + this.type + '->' + this.data;
    }
}

module.exports = Intent;