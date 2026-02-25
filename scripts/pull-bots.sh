#!/bin/bash

set -x 
mkdir -p data/sources
pushd data/sources
for i in $*; do
    git clone $i
done
popd

find data/sources -name 'bot*.json' | xargs -n1 cp {} data/brains/. \;
