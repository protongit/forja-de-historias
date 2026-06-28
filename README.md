# Rol Conversacional

Chatbot interactivo que dirige partidas de rol de mesa conversacionales usando IA generativa. El jugador conversa con un Director de Juego (GM) que narra aventuras, gestiona inventarios, combates por turnos, dados, y progresión del personaje.

## Características

- **Entrevista interactiva**: El GM guía al jugador paso a paso para crear mundo, personaje y aventura
- **Combate táctico**: Sistema de turnos con HP, AC, enemigos y opciones de acción
- **Sistema de dados**: Tiradas de dados (d6, d10, d12, d20) contra estadísticas y DC
- **Inventario**: Gestión automática de objetos del personaje
- **Diario de aventura**: Registro de descubrimientos, encuentros y logros
- **Compañeros NPCs**: Aliados que acompañan al jugador
- **Voz (TTS)**: Narración por voz con diferentes emociones (narrador o API externa)
- **Entrada por voz**: Transcripción de voz a texto para interactuar
- **Adjuntos de imagen**: Envío de imágenes al GM para contexto visual
- **Aventuras precargadas**: 6 aventuras listas para jugar sin configuración
- **Guardado y carga**: Sistema de guardado local con exportación/importación JSON
- **Estadísticas**: Tracking de sesiones, XP, dados, tiempo jugado
- **Leaderboard**: Tabla de clasificación de jugadores (requiere servidor)
- **Streaming**: Respuestas de IA en tiempo real

## Tecnologías

| Capa | Tecnologías |
|------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express 5, better-sqlite3 |
| IA | OpenAI API compatible (GPT-4o-mini por defecto) |
| Despliegue | Docker multi-stage, nginx |

## Requisitos

- Node.js 22+
- npm
- API key de OpenAI (o compatible) — opcional si se usa proxy del servidor

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

El servidor de desarrollo inicia en `http://localhost:5173` con proxy automático al backend en `http://localhost:3000`.

## Build

```bash
npm run build
```

Genera los archivos estáticos en `dist/`.

## Producción

```bash
npm run build && node server.js
```

El servidor escucha en el puerto 3000.

### Docker

```bash
docker build -t rol-conversacional .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e AI_MODEL=gpt-4o-mini \
  rol-conversacional
```

## Configuración del servidor

El servidor se configura mediante el archivo `server-config.json` o mediante variables de entorno (estas últimas tienen prioridad).

### server-config.json

```json
{
  "ai": {
    "endpoint": "https://api.openai.com/v1",
    "apiKey": "",
    "model": "gpt-4o-mini",
    "temperature": 0.8
  },
  "image": {
    "enabled": false,
    "endpoint": "",
    "apiKey": "",
    "model": "flux-2-klein",
    "size": "1024x1024"
  },
  "tts": {
    "enabled": false,
    "endpoint": "https://api.openai.com/v1",
    "apiKey": "",
    "model": "tts-1",
    "voice": "alloy",
    "rate": 1,
    "pitch": 1
  }
}
```

### Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API key para IA | — |
| `OPENAI_TTS_API_KEY` | API key para TTS (si es distinta) | `OPENAI_API_KEY` |
| `OPENAI_IMAGE_API_KEY` | API key para imágenes (si es distinta) | `OPENAI_API_KEY` |
| `AI_ENDPOINT` | Endpoint de la API de IA | `https://api.openai.com/v1` |
| `AI_MODEL` | Modelo de IA | `gpt-4o-mini` |
| `AI_TEMPERATURE` | Temperatura del modelo | `0.8` |
| `IMAGE_ENABLED` | Habilitar generación de imágenes (`true`/`false`) | `false` |
| `IMAGE_ENDPOINT` | Endpoint de generación de imágenes | valor de `ai.endpoint` |
| `IMAGE_MODEL` | Modelo de imágenes | `flux-2-klein` |
| `IMAGE_SIZE` | Tamaño de imagen | `1024x1024` |
| `TTS_ENABLED` | Habilitar TTS (`true`/`false`) | `false` |
| `TTS_MODE` | Modo TTS (`browser`/`external`) | `browser` |
| `TTS_ENDPOINT` | Endpoint TTS | `https://api.openai.com/v1` |
| `TTS_MODEL` | Modelo TTS | `tts-1` |
| `TTS_VOICE` | Voz TTS | `alloy` |
| `TTS_RATE` | Velocidad de voz | `1` |
| `TTS_PITCH` | Tono de voz | `1` |
| `TTS_AUTO_PLAY` | Auto-reproducción (`true`/`false`) | `false` |
| `PORT` | Puerto del servidor | `3000` |
| `DB_PATH` | Ruta a la base de datos SQLite | `./data/game.db` |
| `CONFIG_PATH` | Ruta al archivo de configuración | `./server-config.json` |

Los usuarios invitados usan la API key del servidor. Los usuarios registrados pueden usar su propia API key.

## Protocolo de comandos

El GM emite comandos bracket que el cliente parsea para gestionar el estado del juego:

| Comando | Acción |
|---------|--------|
| `[ADD_ITEM: nombre]` | Añadir objeto al inventario |
| `[REMOVE_ITEM: nombre]` | Eliminar objeto del inventario |
| `[DICE_CHECK: stat: X, dc: N, dice: dX]` | Solicitar tirada de dados |
| `[COMBAT_START: enemigos: ...]` | Iniciar combate |
| `[COMBAT_END]` | Finalizar combate |
| `[ENEMY_DAMAGE: nombre, hp]` | Dañar enemigo |
| `[ADD_XP: cantidad]` | Otorgar experiencia |
| `[LEVEL_UP]` | Subir de nivel |
| `[ADD_COMPANION: nombre, desc, stats: ...]` | Añadir compañero |
| `[JOURNAL_ENTRY: título, resumen, tipo]` | Entrada en diario |
| `[TONE: emoción]` | Cambiar emoción de voz |
| `[PLAYER_DAMAGE: N]` | Dañar al jugador |
| `[PLAYER_HEAL: N]` | Curar al jugador |
| `[SET_PLAYER_HP: hp, max]` | Establecer HP del jugador |
| `[QUEST_COMPLETE]` | Completar la aventura |

## Estructura del proyecto

```
src/
├── components/          # Componentes React UI
│   ├── ChatInterface.tsx    # Chat principal + IA
│   ├── CombatPanel.tsx      # Panel de combate táctico
│   ├── CharacterSheet.tsx   # Ficha de personaje
│   ├── DiceRollOverlay.tsx  # Interfaz de tirada de dados
│   ├── JournalPanel.tsx     # Diario de aventura
│   └── ...
├── context/
│   └── GameContext.tsx       # Estado global (useReducer)
├── services/
│   ├── aiService.ts         # API de IA con streaming
│   ├── authService.ts       # Autenticación local
│   ├── ttsService.ts        # Text-to-Speech
│   └── statsService.ts      # Estadísticas servidor
├── types/
│   └── game.ts              # Tipos TypeScript
└── utils/
    ├── commandCleaner.ts    # Parser de comandos bracket
    └── prompts.ts           # System prompts para la IA
```

## Licencia

MIT
