const log = require('../../hlt/Log');



class GoalIntent {
    constructor(ship, goal, score) {
        this.ship = ship;
        this.goal = goal;
        this.score = score;
    }

    toString() {
        return this.score.toFixed(2) + "#" + this.goal;
    }
}

module.exports = GoalIntent;