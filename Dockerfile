FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN mkdir -p /app/data
COPY --from=build /app/dist ./dist
COPY server.js .
COPY server-config.json .
EXPOSE 3000
ENV DB_PATH=/app/data/game.db
CMD ["node", "server.js"]