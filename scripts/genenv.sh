#!/bin/sh

function genp() {
    LC_ALL=C tr -dc '[:alpha:]' </dev/urandom | head -c 24; echo
}

echo "APIKEY="$(genp)
echo "SECRET="$(genp)