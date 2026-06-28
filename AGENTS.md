# Rol Conversacional — Guía para agentes de IA

## Descripción

Aplicación web de juego de rol conversacional con IA. Un Director de Juego (GM) narrativo interactúa con el jugador usando IA generativa, gestionando mundos, personajes, inventarios, combates tácticos, dados, progresión y diario de aventura.

## Stack tecnológico

| Capa | Tecnologías |
|------|------------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Backend | Node.js 22, Express 5, better-sqlite3 |
| 3D | Three.js / React Three Fiber |
| IA | OpenAI API compatible (GPT-4o-mini por defecto) |
| Despliegue | Docker multi-stage, nginx |

## Estado global

El estado de la aplicación se gestiona con `useReducer` en `src/context/GameContext.tsx`. Los tipos están definidos en `src/types/game.ts` (`GameState`, `GameAction`, `Message`, `Character`, etc.).

## Convenciones de código

- Componentes React funcionales con TypeScript
- Tailwind CSS para estilos (sin archivos CSS separados excepto `index.css` global)
- Estado compartido via `GameContext` con actions tipadas (`GameAction`)
- Servicios (API, auth, TTS, stats, storage) en `src/services/`
- Utilidades (parser de comandos, prompts, motor de juego) en `src/utils/`
- Commands bracket `[COMANDO: ...]` parseados por `commandCleaner.ts`

## Comandos de desarrollo

```bash
npm run dev      # Servidor de desarrollo (Vite + proxy backend)
npm run build    # TypeScript check + build Vite
npm run lint     # ESLint
npm run preview  # Vista previa del build
```

## Estructura del proyecto

```
src/
├── components/        # Componentes React UI
├── context/           # Estado global (GameContext)
├── services/          # Servicios (AI, auth, TTS, stats, storage)
├── types/             # Tipos TypeScript
├── utils/             # Utilidades (parser, prompts, game engine)
├── data/              # Datos (aventuras precargadas)
├── App.tsx            # Componente raíz
├── main.tsx           # Entry point
└── version.ts         # Versión de la aplicación
```

## Regla obligatoria: versionado

Por cada modificación en archivos de código fuente (`.ts`, `.tsx`, `.js`, `.css`, `server.js`), es **obligatorio incrementar el número de versión** en `package.json` siguiendo [Semantic Versioning](https://semver.org/):

- **MAJOR**: cambios incompatibles en API/estructura
- **MINOR**: nuevas funcionalidades compatibles
- **PATCH**: correcciones de errores o cambios menores

La versión actual se muestra en la UI (junto al título en el header) y está definida en `src/version.ts` (importada de `package.json`).