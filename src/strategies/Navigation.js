const log = require('../hlt/Log');
const Planet = require('../hlt/Planet');
const Geometry = require('../hlt/Geometry');
const FibonacciHeap = require('@tyriar/fibonacci-heap');

let grid;
let w;
let h;

function pathFind({x: fromX, y: fromY}, {x: toX, y: toY}) {
    const open = new FibonacciHeap(({key: a}, {key: b}) => a.heuristic - b.heuristic);
    const closed = new Set();
    const parent = new Map();

    const to = grid[g(toX)][g(toY)];
    const from = grid[g(fromX)][g(fromY)];
    from.length = 0;
    from.heuristic = heuristic(from, to);
    open.insert(from);
    closed.add(from);


    while (!open.isEmpty()) {
        const current = open.extractMinimum().key;
        log.log(JSON.stringify(current));

        if (current.type !== ' ') continue;

        if (current.x === to.x && current.y === to.y)
            return backtrack(parent, to);

        neighbors(current)
            .filter(n => !closed.has(n))
            .forEach(n => {
                n.length = current.length + 1;
                n.heuristic = heuristic(n, to);

                parent.set(n, current);
                open.insert(n);
                closed.add(n);
            });
    }
    return [];
}

function backtrack(parent, to) {
    const path = [to];
    let current = to;
    while (current.length > 0) {
        current = parent.get(current);
        path.push(current);
    }
    return path.reverse();
}

function heuristic(from, to) {
    return Geometry.distance(from, to);
}

function neighbors(node) {
    return [
        {x: node.x - 1, y: node.y},
        {x: node.x, y: node.y - 1},
        {x: node.x + 1, y: node.y},
        {x: node.x, y: node.y + 1}]
        .filter(({x, y}) => x >= 0 && y >= 0 && x < w && y < h)
        .map(({x, y}) => grid[x][y]);
}

function resetGrid(gameMap) {
    w = g(gameMap.width);
    h = g(gameMap.height);

    grid = new Array(w);
    for (let x = 0; x < w; x++) {
        grid[x] = new Array(h);
        for (let y = 0; y < h; y++) {
            grid[x][y] = {type: ' ', x, y, length: Infinity, heuristic: 0};
        }
    }

    [...gameMap.planets, ...gameMap.allShips].forEach(e => {
        let char = (e instanceof Planet) ? 'p' : 's';
        for (let dx = -e.radius; dx <= e.radius; dx++) {
            for (let dy = -e.radius; dy <= e.radius; dy++) {
                if (Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2)) <= e.radius + 0.5) {
                    grid[g(e.x + dx)][g(e.y + dy)].type = char;
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
    let yRes = 1;

    for (let y = 0; y < h; y += yRes) {
        let string = '';
        for (let x = 0; x < w; x += xRes) {
            let char = ' ';

            for (let dx = 0; dx < xRes; dx++)
                for (let dy = 0; dy < yRes; dy++)
                    if (grid[x + dx][y + dy] !== ' ')
                        char = grid[x + dx][y + dy].type;

            string += char;
        }
        log.log(string);
    }
}

module.exports = {resetGrid, pathFind, logDump};