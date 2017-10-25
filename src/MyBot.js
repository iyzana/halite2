const Game = require('./hlt/Game');
const {strategy} = require('./strategies/Strategy');

Game.start('succcubbus', strategy);
