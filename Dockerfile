FROM node:lts-alpine3.16

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache openssl

RUN openssl req -x509 -newkey rsa:4096 -keyout /etc/ssl/private/key.pem -out /etc/ssl/private/cert.pem -days 365 -nodes -subj "/CN=localhost"

ENV NODE_ENV=production
ENV HTTPS=true
ENV SSL_KEY_PATH=/etc/ssl/private/key.pem
ENV SSL_CERT_PATH=/etc/ssl/private/cert.pem

RUN apk add ffmpeg

RUN npm install --omit=dev  && npm cache clean --force

COPY . .

CMD ["node", "index.js"]

EXPOSE 3000

