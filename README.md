
# eBOT Development environment

## Requirements:

- `git`
- `docker` or `nodejs`

## Installation

Clone this repo
```shell
git clone git@git.internal.ru.com:RUNA/arch-fun-ebot-server.git
cd arch-fun-ebot-server
```

### with Docker

```shell
# scripts/genenv.sh > .env
docker compose build
docker compose up
# open http://lcoalhost:5001
```

### with nodejs

```shell
# scripts/genenv.sh > .env
# source .env
cd matterjs-bots
npm i
PORT=5001 PROCS=2 SIMULATOR_INJECT_DEBUG_INTO_ROBOT=0 SIMULATOR_FAST_RESOLUTION=0 node server.js
# open http://lcoalhost:5001
```

## Usage Instructions

0) optional: you can copy existing example bots code: `cp matterjs-bots/battle/brains/drivers-ext/*.json data/brains/.`
1) Open http://localhost:5001
2) Add 1 browser bot (`__BROWSERBOT__`) plus any other bot (e.g. `default`)
3) Click Start button
4) Attach debugger in the top-left R#0 button
5) Click "connect" button
6) Add code in the Brain Code section
7) Click on "See Arena" to watch your code realtime
8) Click Upload to save it to data/brains/botXXXXXX.json (XXXXX is the ID of the current arena)

Instructions on how to submit your bot to the competition matches will be published at https://wiki.corp-apps.com/x/A9LdJQ

