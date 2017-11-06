class ActionThrust {
    constructor(ship, speed, angle) {
        this.ship = ship;
        this.speed = speed;
        this.angle = angle;
    }

    getCommand() {
        return this.ship.thrust(this.speed, this.angle);
    }
}

module.exports = ActionThrust;