FROM node:8
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
EXPOSE 8080
COPY . .
CMD ["node", "bot.js"]