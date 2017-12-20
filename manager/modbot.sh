#!/bin/bash

if [[ -z "$2" ]]; then
    python3 manager.py -A $1 -p "node ../dist/$1/MyBot.js"
fi

if [[ "$1" = "add" ]]; then
    python3 manager.py -A $2 -p "node ../dist/$2/MyBot.js"
elif [[ "$1" = "rm" ]]; then
    python3 manager.py -D $2
fi

