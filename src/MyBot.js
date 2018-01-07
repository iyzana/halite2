#!/usr/bin/node

const Game = require('./hlt/Game');
const {strategy} = require('./strategies/Strategy');

Game.start({botName: 'succcubbus',
    preProcessing: map => {},
    strategy});
