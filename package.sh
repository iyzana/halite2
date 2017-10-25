#!/bin/bash

file='dist/succcubbus.zip'

if [ -f $file ]; then
	rm $file
fi

cd src && 7z a "../$file" * && cd ..
