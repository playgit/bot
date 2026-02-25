# roboneo code / matterjs-bots

a physics-based coding-oriented multi-robot battle game

**reporting issues, and asking for help**

* first, **search online for any error message you get** - very likely
  somebody else had the same problem and posted a solution already
* when asking others, it is better to **copy and paste the text of the
  error/code/etc** to others
* **avoid sending screenshots and pictures of text** - programmers are lazy
  and do not want to retype pictures of text ;)
* explain to the other person what you are trying to do in **as much details
  as possible** - explain what you have tried already as well
* **never share confidential information** when asking for help - for this
  game, do not share your "Robot Key"

## LOCAL SETUP

want to write/debug robots locally without internet?
follow these steps to get started

**all these steps must run on a linux terminal**

basically...

```
# go to user home directory
cd ~
# show "present working directory"
pwd
```

...means you open a `linux terminal`; type/copy/paste `cd ~`;
hit the ENTER key; then type `pwd`; then hit the ENTER key

note: lines beginning with a `#` are comments for the user -
do not enter into the terminal

### LOCAL SETUP 1/3: prepare

recommended operating systems:

* linux
* windows, install WSL Ubuntu -
  [step-by-step guide](https://ubuntu.com/tutorials/install-ubuntu-on-wsl2-on-windows-10)

required language and version: `nodejs 18.x`

on the `linux` terminal, enter the following:

```
# update system packages
sudo apt update
sudo apt upgrade
# reply Y if prompted, system may update/upgrade stuff, may take time

# install nodejs, may take time
sudo apt install nodejs
sudo apt install npm

# upgrade node to stable
sudo npm install n -g
sudo n stable
```

### LOCAL SETUP 2/3: install

`git clone` or download an archive (e.g. `zip`, `tar.gz`) of this repo

if an archive, extract the files into a directory of your
choice - preferably somewhere in your `home` directory

`cd` into the base directory of the repo/extracted files

in the base directory (contains this `README.md`):

```
# install nodejs libraries, may take time
npm install

# copy default configuration
cp .env.sample .env
```

### LOCAL SETUP 3/3: run and use

```
# start single-thread server
node server.js
```

open a browser and access http://localhost:5001/

this is good enough to write and test robots via the
browser-based code editor on the robot control panel

## TODO / notes / ideas

### technical

**consistent front-end UI/UX**

* block-style programming?
* canvas reprojection e.g. render arena with WebGL

**pre-competition tools**

* self-service submission checker
* robot id and key verifier

**better multiprocess management**

### ideas

**new/optional rule sets**

* provide feedback on angle and range of enemy projectile
* limited ammo, corrolary ammo does more damage; using ammo drains health
* enemy hit by ammo can add health (incentive for chase and shoot)

**rule-set cards metagame**

* apply temporary arena and robot modifiers
* size/mass depends on code length

## DEV SETUP - for game developers/debuggers

* this is for devs working on the codebase, not robots!
* uses `multiserver.js` which will fork multiple `server.js` on
  adjacent ports as configured in `.env`
* follow LOCAL SETUP steps 1-3

```
# nodemon watches for file changes and autorestarts processes
npm install nodemon --global

# linux
nodemon multiserver.js
#   OR
# WSL2, symlinked WIN folder (use --legacy-watch mode)
nodemon -L multiserver.js
```

## SERVER DEPLOY, with load-balancing

* only required for online server deployments
* requires: `nginx` or similar reverse proxy

### SERVER DEPLOY step 1/3: configure `.env`

specify number of cores in `PROCS` and starting `PORT`

for example, if planning to use 3 cores/processes, these lines are important:

```
PORT=5001
PROCS=3
```

### SERVER DEPLOY step 2/3: configure `nginx`

for example, if planning to use 3 cores/processes:

```
upstream web {
    least_conn;
    server 127.0.0.1:5001;
    server 127.0.0.1:5002;
    server 127.0.0.1:5003;
}

map $arg_balancerid $upserve {
    default "127.0.0.1:5001";
    2 "127.0.0.1:5002";
    3 "127.0.0.1:5003";
}

server {
    location ~* /socket.io {
        proxy_pass http://$upserve;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $http_host;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Nginx-Proxy true;

        proxy_redirect off;
    }

    location / {
        proxy_pass http://web;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $http_host;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Nginx-Proxy true;

        proxy_redirect off;
    }
}
```

* server list must match in `upstream` and `map` blocks
* sticky sessions are based on arena ids and do
  not use conventional `nginx` session persistence

### SERVER DEPLOY step 3/3: run in multiserver mode

```
node multiserver.js
```

this will fork `PROCS` number of processes on `PORT`
and subsequent ports as specified in `.env`


## acknowledgements

the authors would like to acknowledge our friends and partners for
**ROBONEO 2022** organised on 26-27th November 2022:

* Ministry of Science, Technology, and Innovation Sabah (KSTI)
* Sabah Creative Economy and Innovation Centre (SCENIC)
* Kinabalu Coders

the authors would also like to thank and recognise the contributors
and pioneering players of the inaugural **RBN-CODE** competition category:

* SK PORING RANAU, placed 1st with robot `EDDO ROBOTZ`
* KOLEJ KOMUNITI TAWAU, placed 2nd with `PHNTOM`
* `Darkstar` (individual), placed 3rd
* POLITEKNIK PORT DICKSON, won royal rumble (showcase) with `Zeusbot`
* POLITEKNIK KOTA KINABALU SABAH
* KOLEJ VOKASIONAL LIKAS
* KOLEJ KOMUNITI SEGAMAT 2
* SMA AL-IRSYADIAH
* SMA MOHAMMAD ALI
* KOLEJ VOKASIONAL BEAUFORT
* ILP KOTA KINABALU
* `pewpewpew` (individual)
* `FZ` (individual)
* `MICROBOT` (individual)
* `PIK Team` (individual)

big thanks to the awesome [matterjs](https://brm.io/matter-js/)
library for the 2d physics simulation, and
[babylonjs](https://www.babylonjs.com/) for 3d rendering

credits to [Star Control 2 - Ur-Quan Masters](https://sc2.sourceforge.net/)
and [mixkit.co](https://mixkit.co/) for great sound effects and music

"low poly space ship" (https://skfb.ly/H9qJ) by chrisonciuconcepts 
is licensed under Creative Commons Attribution 
(http://creativecommons.org/licenses/by/4.0/)

"Pixel Space Ship" (https://skfb.ly/o6A7p) by Bucky 
is licensed under Creative Commons Attribution 
(http://creativecommons.org/licenses/by/4.0/).