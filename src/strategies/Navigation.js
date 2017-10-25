const log = require('../hlt/Log');
const Planet = require('../hlt/Planet');

let grid;
let w;
let h;

function pathFind(from, to) {
    from = {x: g(from.x), y: g(from.y)};
    to = {x: g(to.x), y: g(to.y)};


}

function resetGrid(gameMap) {
    w = g(gameMap.width);
    h = g(gameMap.height);

    grid = new Array(w);
    for (let x = 0; x < w; x++) {
        grid[x] = new Array(h);
        for (let y = 0; y < h; y++) {
            grid[x][y] = ' ';
        }
    }

    [...gameMap.planets, ...gameMap.allShips].forEach(e => {
        let char = (e instanceof Planet) ? 'p' : 's';
        for (let dx = -e.radius; dx <= e.radius; dx++) {
            for (let dy = -e.radius; dy <= e.radius; dy++) {
                if (Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2)) <= e.radius + 0.5) {
                    grid[g(e.x + dx)][g(e.y + dy)] = char;
                }
            }
        }
    });

    // logDump();
}

function g(c) {
    return Math.floor(c);
}

function ig(c) {
    return c + 0.5;
}

function logDump() {
    let xRes = 1;
    let yRes = 2;

    for (let y = 0; y < h; y+=yRes) {
        let string = '';
        for (let x = 0; x < w; x+=xRes) {
            let char = ' ';

            for (let dx = 0; dx < xRes; dx++)
                for (let dy = 0; dy < yRes; dy++)
                    if (grid[x + dx][y + dy] !== ' ')
                        char = grid[x + dx][y + dy];

            string += char;
        }
        log.log(string);
    }
}

module.exports = {resetGrid};