FROM node:lts-alpine3.16

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache openssl

RUN openssl req -x509 -newkey rsa:4096 -keyout /certs/key.pem -out /certs/cert.pem -days 365 -nodes -subj "/CN=localhost"

COPY certs /app/certs

ENV NODE_ENV=production
ENV HTTPS=true
ENV SSL_KEY_PATH=/app/certs/key.pem
ENV SSL_CERT_PATH=/app/certs/cert.pem

RUN apk add ffmpeg

RUN npm install --production  && npm cache clean --force

COPY . .

CMD ["node", "index.js"]

EXPOSE 3000

