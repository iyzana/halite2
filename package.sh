#!/bin/bash

date=$(date +%Y%m%d%H%M%S)
file="../dist/succcubbus-$date.zip"

cd src && 7z a $file * && cd ..
