const Game = require('./hlt/Game');
const {strategy} = require('./strategies/MyStrategy');

Game.start('succcubbus', strategy);
