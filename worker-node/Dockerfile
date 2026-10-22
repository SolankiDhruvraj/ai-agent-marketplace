FROM node:20-alpine

WORKDIR /app

# Install git for repo checkout & diffs
RUN apk add --no-cache git bash

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

CMD ["npm", "start"]
