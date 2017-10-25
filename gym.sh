#!/usr/bin/env bash

client="client/client.py"

release=$1
if [ -z "$release" ]; then
    unset -v latest
    for file in dist/*; do
        [[ -d ${file} && ${file} -nt ${latest} ]] && latest=${file};
    done

    release=${latest};
fi

echo "training against $release"

python ${client} gym -r "node 'src/MyBot.js'" -r "node '$release/MyBot.js'" -b ./halite -W 240 -H 160

[[ -d replay ]] || mkdir replay
mv replay-*.hlt replay

[[ -d log ]] && rm -rf log
mkdir log
mv *.log log