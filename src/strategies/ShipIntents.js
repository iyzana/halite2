class ShipIntents {
    constructor(ship, intents) {
        this.ship = ship;
        this.intents = intents;
    }

    toString() {
        return "" + this.ship + ": " + this.intents;
    }
}

module.exports = ShipIntents;