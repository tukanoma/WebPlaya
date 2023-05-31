FROM node:lts-alpine3.16

WORKDIR /app

COPY package*.json ./


RUN npm install --production  && npm cache clean --force

COPY . .

EXPOSE 3000

