#!/usr/bin/env bash

client="client/client.py"

if [[ -z "$1" ]]; then
    src="src"
elif [[ "$1" = "src" ]]; then
    src="src"
else
    src="dist/$1"
fi

if [[ -z "$2" ]]; then
    number=1
    folder="dist/"

    while [ -d "${folder}v$number" ]; do
        number=$(( number + 1 ))
    done
    number=$(( number - 1 ))

    release="${folder}v$number";
elif [[ "$2" = "src" ]]; then
    release="src"
else
    release="dist/$2"
fi

echo "training #0 $src against #1 $release"

python ${client} gym -r "node '$src/MyBot.js'" -r "node '$release/MyBot.js'" -b ./halite -W 240 -H 160

[[ -d replay ]] || mkdir replay
mv replay-*.hlt replay

[[ -d log ]] && rm -rf log
mkdir log
mv *.log log