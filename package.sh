#!/usr/bin/env bash

date=$(date +%Y%m%d%H%M%S)
folder="dist/$date"

cp -r src ${folder}
cd ${folder}
7z a "succcubbus.zip" *
