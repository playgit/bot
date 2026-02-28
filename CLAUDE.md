# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

eBOT is a physics-based robot battle arena where users write JavaScript to control virtual robots. Robots fight in a 2D arena powered by Matter.js physics, with real-time visualization via Socket.IO.

## Development Commands

```bash
# Setup (strict-ssl disabled due to internal registry/proxy requirements)
cd matterjs-bots && npm config set strict-ssl false && npm install

# Run (single process)
PORT=5001 node matterjs-bots/server.js

# Run (multi-process with auto-reload)
PORT=5001 PROCS=2 nodemon matterjs-bots/multiserver.js

# Docker
docker compose build && docker compose up   # http://localhost:5001
```

There is no test suite, linter, or formatter configured.

## Architecture

All application code lives under `matterjs-bots/`.

**Server layer** — `server.js` is the Express HTTP + Socket.IO entry point. `multiserver.js` forks multiple processes with IPC coordination via `procman.js`.

**Simulation core** — `battle/simulation.js` runs the Matter.js physics loop (60 FPS physics, 15 FPS client updates). Each arena is an isolated simulation instance created via factory pattern.

**Robot AI execution** — `battle/brains/cogitator.js` runs each robot's "brain" code every tick. User code is executed in a VM2 sandbox (`battle/brains/sandbox.js`) with a 500ms timeout. The brain receives a context object with read-only `state`, writable `action`, persistent `memory`, and `round` info.

**Brain drivers** — `battle/brains/drivers/` contains brain strategies: `debug.js` (built-in example bot) and `socket.js` (remote browser-controlled bot via WebSocket).

**Manager modules** (server root):
- `sockman.js` — Socket.IO event handling, broadcasts simulation state to clients
- `arenaman.js` — Arena creation and lifecycle management
- `robotman.js` — Robot brain persistence (JSON files on disk), key validation (SHA256 salted)
- `compman.js` — Tournament/competition queue and match management
- `logman.js` — Result recording to CSV (rolling 1000 rows) and JSON

**Frontend** — `static/` contains Canvas-based 2D rendering (`arena-visuals.js`), optional Babylon.js 3D renderer, and React 16 components (UMD via CDN). Templates in `views/` use Nunjucks.

**User robot brains** are stored as JSON files in `battle/brains/drivers-ext/` (example bots) and `data/brains/` (user uploads).

## Key Environment Variables

- `PORT` — HTTP port (default 5001)
- `APIKEY` — API key for privileged operations (auto-generated via `scripts/genenv.sh`)
- `SECRET` — Salt for robot key hashing
- `PROCS` — Number of forked processes
- `SIMULATOR_FAST_RESOLUTION` — Run simulation offline (not realtime)
- `SIMULATOR_INJECT_DEBUG_INTO_ROBOT` — Include debug info in robot context

## Routes

- `GET /` — Home page
- `POST /arena/:arenaid` — Create/view arena
- `GET/POST /robot/update` — Robot editor
- `POST /api/competition/:compid` — Tournament endpoint
- `GET /api/status` — System status
