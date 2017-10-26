#!/usr/bin/env bash

./halite -d "240 160" "node src/MyBot.js" "node dist/20171026202529-v5/MyBot.js"

[[ -d replay ]] || mkdir replay
mv replay-*.hlt replay

[[ -d log ]] && rm -rf log
mkdir log
mv *.log log