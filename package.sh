#!/usr/bin/env bash

number=1
folder="dist/"

while [[ -d "${folder}v$number" ]]; do
    number=$(( number + 1 ))
done

folder="${folder}v$number"

cp -r src ${folder}
cd ${folder}
sed -i "s#logFile\.write#// logFile.write#g" hlt/Log.js
7z a "succcubbus-v$number.zip" *
sed -i "s/succcubbus/succcubbus-v$number/" MyBot.js