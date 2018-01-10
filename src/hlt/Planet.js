const log = require('./Log');
const constants = require('./Constants');
const Geometry = require('./Geometry');

const Entity = require('./Entity');

class Planet extends Entity {
    /**
     * @param {GameMap} gameMap map this planet belongs to
     * @param {object} params planet information
     */
    constructor(gameMap, params) {
        super(params);
        this._params = params;
        this._gameMap = gameMap;
    }

    /**
     * Determines if the planet has an owner.
     * @returns {boolean} true if planet is owned
     */
    isOwned() {
        return this.ownerId !== null &&
            typeof this.ownerId !== 'undefined';
    }

    /**
     * Determines if the planet owner is you.
     * @returns {boolean} true if planet is owned by you
     */
    isOwnedByMe() {
        return this.ownerId === this._gameMap.myPlayerId;
    }

    /**
     * Determines if the planet owner is not you.
     * @returns {boolean} true if planet is owned by you
     */
    isOwnedByEnemy() {
        return this.isOwned() && this.ownerId !== this._gameMap.myPlayerId;
    }

    /**
     * Determines if the planet is free.
     * @returns {boolean} true if planet is free
     */
    isFree() {
        return this.ownerId === null ||
            typeof this.ownerId === 'undefined';
    }

    /**
     * id of the player who currently owns this planet
     * @returns {*|number}
     */
    get ownerId() {
        return this._params.ownerId;
    }

    /**
     * number of docking spots in this planet
     * @return {number} number of docking spots in this planet
     */
    get dockingSpots() {
        return this._params.dockingSpots;
    }

    /**
     * number of ships than can still dock this planet
     * @returns {number}
     */
    get freeDockingSpots() {
        return this.dockingSpots - this.numberOfDockedShips;
    }

    calcShipSpawnPoint() {
        let bestLocation = this;
        let bestDistance = Infinity;
        const center = {
            x: this._gameMap.width / 2.0,
            y: this._gameMap.height / 2.0
        };

        const maxDelta = constants.SPAWN_RADIUS;
        const openSpaceRadius = constants.SHIP_RADIUS * 3;
        for (let dx = -maxDelta; dx <= maxDelta; dx++) {
            for (let dy = -maxDelta; dy <= maxDelta; dy++) {
                const angle = Math.atan2(dy, dx);
                const offsetX = dx + this.radius * Math.cos(angle);
                const offsetY = dy + this.radius * Math.sin(angle);
                const location = {
                    x: this.x + offsetX,
                    y: this.y + offsetY
                };

                if (location.x < 0 || location.x >= this._gameMap.width ||
                    location.y < 0 || location.y >= this._gameMap.height){
                    continue;
                }

                const distance = Geometry.distance(location, center);

                const collides = this._gameMap.planets
                    .concat(this._gameMap.allShips)
                    .some(entity => Geometry.distance2(entity, location) < Math.pow(entity.radius + openSpaceRadius, 2));


                if (distance < bestDistance && !collides) {
                    bestDistance = distance;
                    bestLocation = location;
                }
            }
        }

        if (bestDistance !== Infinity) {
            return bestLocation;
        } else {
            return null;
        }
    }

    /**
     * determines if there is docking spot available
     * @return {boolean} true if there is a docking spot
     */
    hasDockingSpot() {
        return this.numberOfDockedShips < this._params.dockingSpots;
    }

    /**
     * accumulated production in this planet, ships spawn at 72
     *
     * @returns {number}
     */
    get currentProduction() {
        return this._params.currentProduction;
    }

    get remainingProduction() {
        return this._params.remainingProduction;
    }

    /**
     * docked ship ids
     * @returns {number[]}
     */
    get dockedShipIds() {
        return this._params.dockedShipIds;
    }

    /**
     * number of docked ships
     * @returns {number}
     */
    get numberOfDockedShips() {
        return this.dockedShipIds.length;
    }

    /**
     * docked ships instances
     * @returns {Ship[]}
     */
    get dockedShips() {
        return this._gameMap.shipsByIds(this.dockedShipIds);
    }

    toString() {
        return 'p' + this._params.id;
    }
}

module.exports = Planet;
