const log = require('../hlt/Log');
const Planet = require('../hlt/Planet');
const Geometry = require('../hlt/Geometry');
const FibonacciHeap = require('@tyriar/fibonacci-heap');

let grid;
let w;
let h;

function pathFind({x: fromX, y: fromY}, {x: toX, y: toY}) {
    const open = new FibonacciHeap();
    const openHeapNodes = new Map();
    const closed = new Set();
    const parent = new Map();

    const to = grid[g(toX)][g(toY)];
    const from = grid[g(fromX)][g(fromY)];
    from.length = 0;
    from.heuristic = heuristic(from, to);

    const startNode = open.insert(from.heuristic, from);
    openHeapNodes.set(from, startNode);

    while (!open.isEmpty()) {
        const entry = open.extractMinimum();
        const current = entry.value;

        closed.add(current);
        openHeapNodes.delete(current);

        if (current.type !== ' ') continue;

        // log.log(JSON.stringify(entry.key) + " -> " + JSON.stringify(entry.value));

        if (current.x === to.x && current.y === to.y)
            return backtrack(parent, to);

        neighbors(current).forEach(n => {
            let dx = n.x - current.x;
            let dy = n.y - current.y;
            let length = current.length + Math.sqrt(dx ** 2 + dy ** 2);

            if (closed.has(n) && length >= n.length)
                return;

            const currNeighbor = openHeapNodes.get(n);

            if (currNeighbor === undefined) {
                parent.set(n, current);
                n.length = length;
                n.heuristic = heuristic(n, to);

                const node = open.insert(n.heuristic + n.length, n);
                openHeapNodes.set(n, node);
            } else if (length < currNeighbor.value.length) {
                parent.set(n, current);
                n.length = length;

                open.decreaseKey(currNeighbor, n.heuristic + n.length);
            }
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
    return Geometry.distance(from, to) * 1.1;
}

function neighbors(node) {
    return [
        {x: node.x - 1, y: node.y - 1},
        {x: node.x - 1, y: node.y},
        {x: node.x - 1, y: node.y + 1},
        {x: node.x, y: node.y - 1},
        {x: node.x, y: node.y + 1},
        {x: node.x + 1, y: node.y - 1},
        {x: node.x + 1, y: node.y},
        {x: node.x + 1, y: node.y + 1}]
        .filter(({x, y}) => x >= 0 && y >= 0 && x < w && y < h)
        .map(({x, y}) => grid[x][y]);
}

function resetGrid(gameMap, startEntities) {
    w = g(gameMap.width);
    h = g(gameMap.height);

    grid = new Array(w);
    for (let x = 0; x < w; x++) {
        grid[x] = new Array(h);
        for (let y = 0; y < h; y++) {
            grid[x][y] = {type: ' ', x, y};
        }
    }

    [...gameMap.planets, ...gameMap.allShips]
        .filter(e => !startEntities.some(e2 => e.id === e2.id))
        .forEach(e => {
            let char = (e instanceof Planet) ? 'p' : 's';
            for (let dx = -e.radius; dx <= e.radius; dx++) {
                for (let dy = -e.radius; dy <= e.radius; dy++) {
                    if (Math.sqrt(dx ** 2 + dy ** 2) <= e.radius + 0.5) {
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