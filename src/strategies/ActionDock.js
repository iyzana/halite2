class ActionDock {
    constructor(ship, planet) {
        this.ship = ship;
        this.planet = planet;
    }

    getCommand() {
        return this.ship.dock(this.planet);
    }
}

module.exports = ActionDock;