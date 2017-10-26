const Planet = require('../hlt/Planet');
const Log = require('../hlt/Log');
const {pathFind, resetGrid, logDump} = require('./Navigation');
const {findPath} = require('./Navigation');

Log.init('test.log');

const gameMap = {
    width: 60,
    height: 60,
    planets: [new Planet(null, {x: 10, y: 10, radius: 5}), new Planet(null, {x: 30, y: 25, radius: 2})],
    allShips: [],
};

// findPath(gameMap, {x: 0, y: 0}, {x: 50, y: 50})
// return;

resetGrid(gameMap, []);
const path = pathFind({x: 0, y: 0}, {x: 50, y: 50});
path.forEach(e => {
    e.type = 'a';
    delete e.heuristic;
});
console.log(path);
logDump();

