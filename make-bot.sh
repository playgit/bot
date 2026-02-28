#!/bin/bash
# Usage: ./make-bot.sh <brain.js> <botid> <botname>
# Creates matterjs-bots/battle/brains/drivers-ext/<botid>.json
BRAIN=$(cat "$1")
BOTID="$2"
BOTNAME="$3"
node -e "
var fs=require('fs');
var brain=process.env.BRAIN;
var json={id:process.env.BOTID,key:false,name:process.env.BOTNAME,team:'predators',brain:brain,version:1,updated:new Date().toISOString(),oldBrains:[]};
fs.writeFileSync('matterjs-bots/battle/brains/drivers-ext/'+process.env.BOTID+'.json',JSON.stringify(json,null,4));
console.log('Created '+process.env.BOTID+'.json');
"
