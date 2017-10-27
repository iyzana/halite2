#!/usr/bin/env bash

if [ -z "$1" ]; then
    number=1
    folder="dist/"

    while [ -d "${folder}v$number" ]; do
        number=$(( number + 1 ))
    done
    number=$(( number - 1 ))

    release="${folder}v$number";
else
    release="dist/$1"
fi

echo "diffing with $release"

git diff --no-index "$release" "src"