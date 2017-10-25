#!/usr/bin/env bash

release=$1
if [ -z "$release" ]; then
    unset -v latest
    for file in dist/*; do
        [[ -d ${file} && ${file} -nt ${latest} ]] && latest=${file};
    done

    release=${latest};
fi

echo "diffing with $release"

git diff --no-index "$release" "src"