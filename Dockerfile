FROM node:20-alpine

WORKDIR /www

COPY package.json package-lock.json* /www/

RUN npm install --omit=dev

COPY . /www

EXPOSE 3000

CMD ["node", "src/app.js"]
