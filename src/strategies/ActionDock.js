class ActionDock {
    constructor(ship, planet, isDocking) {
        this.ship = ship;
        this.planet = planet;
        this.isDocking = isDocking;
    }

    getCommand() {
        return this.isDocking ? this.ship.dock(this.planet) : this.ship.unDock();
    }
}

module.exports = ActionDock;