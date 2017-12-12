#!/usr/bin/env bash

folder="dist/"
number=1

if [[ -z "$1" ]]; then
    while [[ -d "${folder}v$number" ]]; do
        number=$(( number + 1 ))
    done

else
    number="$1"
    if [[ -d "${folder}v$number" ]]; then
        echo "directory exists, aborting"
        exit
    fi
fi

folder="${folder}v$number"

cp -r src ${folder}
cd ${folder}
sed -i "s#logFile\.write#// logFile.write#g" hlt/Log.js
7z a "succcubbus-v$number.zip" *
sed -i "s/succcubbus/succcubbus-v$number/" MyBot.js