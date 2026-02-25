FROM node

WORKDIR /app
COPY scripts/entrypoint.sh /entrypoint.sh
COPY matterjs-bots /app

RUN npm install

ENTRYPOINT ["/entrypoint.sh"]
