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
- **Aventuras precargadas**: 3 aventuras listas para jugar sin configuración
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
| 3D | Three.js / React Three Fiber (dados animados) |
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
docker run -p 3000:3000 rol-conversacional
```

## Configuración del servidor

El archivo `server-config.json` configura las API keys y modelos:

```json
{
  "ai": {
    "endpoint": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "model": "gpt-4o-mini",
    "temperature": 0.8
  },
  "tts": {
    "enabled": false,
    "endpoint": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "model": "tts-1",
    "voice": "alloy",
    "rate": 1,
    "pitch": 1
  }
}
```

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
| `[HINT]` | Usar una pista |
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
│   ├── DiceRollOverlay.tsx  # Dados 3D animados
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
