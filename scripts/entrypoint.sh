#!/bin/sh

MODE=$1
exec node /app/${MODE:-server}.js
