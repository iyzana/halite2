class GoalIntent {
    constructor(ship, goal, score) {
        this.ship = ship;
        this.goal = goal;
        this.score = score;
    }

    toString() {
        const roundedScore = (Math.round(this.score * 10) / 10);

        return roundedScore + "#" + this.goal;
    }
}