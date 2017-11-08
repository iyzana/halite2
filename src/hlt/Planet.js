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
