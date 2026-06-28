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

# Configuración vía variables de entorno (opcional)
# AI_ENDPOINT, AI_MODEL, AI_TEMPERATURE
# IMAGE_ENABLED, IMAGE_ENDPOINT, IMAGE_MODEL, IMAGE_SIZE
# TTS_ENABLED, TTS_MODE, TTS_ENDPOINT, TTS_MODEL, TTS_VOICE, TTS_RATE, TTS_PITCH, TTS_AUTO_PLAY
# OPENAI_API_KEY, OPENAI_TTS_API_KEY, OPENAI_IMAGE_API_KEY

CMD ["node", "server.js"]