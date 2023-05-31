FROM node:lts-alpine3.16

WORKDIR /app

COPY package*.json ./


RUN npm install --production  && npm cache clean --force

COPY . .

CMD ["node", "index.js"]

EXPOSE 3000

