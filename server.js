import { Readable } from 'stream'
import { randomUUID } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import rateLimit from 'express-rate-limit'
import Database from 'better-sqlite3'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(process.env.PORT || '3000', 10)
const CONFIG_PATH = process.env.CONFIG_PATH || './server-config.json'
const DB_PATH = process.env.DB_PATH || resolve(__dirname, 'data', 'game.db')

function loadConfig() {
  const configPath = resolve(CONFIG_PATH)
  let config
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, 'utf-8'))
  } else {
    console.warn(`Config file not found: ${configPath}, using defaults + env vars`)
    config = {
      ai: { endpoint: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini', temperature: 0.8 },
      image: { enabled: false, endpoint: '', apiKey: '', model: 'flux-2-klein', size: '1024x1024' },
      tts: { enabled: false, mode: 'browser', endpoint: 'https://api.openai.com/v1', apiKey: '', model: 'tts-1', voice: 'alloy', rate: 1, pitch: 1, autoPlay: false },
    }
  }

  config.ai.endpoint = process.env.AI_ENDPOINT || config.ai.endpoint
  config.ai.model = process.env.AI_MODEL || config.ai.model
  config.ai.temperature = parseFloat(process.env.AI_TEMPERATURE || String(config.ai.temperature))

  if (process.env.IMAGE_ENABLED !== undefined) config.image.enabled = process.env.IMAGE_ENABLED === 'true'
  if (process.env.IMAGE_ENDPOINT !== undefined) config.image.endpoint = process.env.IMAGE_ENDPOINT
  if (process.env.IMAGE_MODEL !== undefined) config.image.model = process.env.IMAGE_MODEL
  if (process.env.IMAGE_SIZE !== undefined) config.image.size = process.env.IMAGE_SIZE

  if (process.env.TTS_ENABLED !== undefined) config.tts.enabled = process.env.TTS_ENABLED === 'true'
  if (process.env.TTS_MODE !== undefined) config.tts.mode = process.env.TTS_MODE
  config.tts.endpoint = process.env.TTS_ENDPOINT || config.tts.endpoint
  config.tts.model = process.env.TTS_MODEL || config.tts.model
  config.tts.voice = process.env.TTS_VOICE || config.tts.voice
  config.tts.rate = parseFloat(process.env.TTS_RATE || String(config.tts.rate))
  config.tts.pitch = parseFloat(process.env.TTS_PITCH || String(config.tts.pitch))
  if (process.env.TTS_AUTO_PLAY !== undefined) config.tts.autoPlay = process.env.TTS_AUTO_PLAY === 'true'

  return config
}

const serverConfig = loadConfig()

function getApiKey() {
  return process.env.OPENAI_API_KEY || serverConfig.ai.apiKey || ''
}

function getTtsApiKey() {
  return process.env.OPENAI_TTS_API_KEY || process.env.OPENAI_API_KEY || serverConfig.tts.apiKey || ''
}

function getImageApiKey() {
  return process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY || serverConfig.image?.apiKey || ''
}

// SQLite setup
mkdirSync(dirname(DB_PATH), { recursive: true })
let db
try {
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      adventure_name TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      level INTEGER DEFAULT 1,
      xp_total INTEGER DEFAULT 0,
      enemies_defeated INTEGER DEFAULT 0,
      time_played_ms INTEGER DEFAULT 0,
      messages_sent INTEGER DEFAULT 0,
      dice_rolls INTEGER DEFAULT 0,
      dice_successes INTEGER DEFAULT 0,
      dice_failures INTEGER DEFAULT 0,
      result TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  // Migration helpers for existing DBs
  try { db.exec(`ALTER TABLE game_stats ADD COLUMN session_id TEXT`) } catch (e) {}
  try { db.exec(`ALTER TABLE game_stats ADD COLUMN messages_sent INTEGER DEFAULT 0`) } catch (e) {}
  try { db.exec(`ALTER TABLE game_stats ADD COLUMN dice_rolls INTEGER DEFAULT 0`) } catch (e) {}
  try { db.exec(`ALTER TABLE game_stats ADD COLUMN dice_successes INTEGER DEFAULT 0`) } catch (e) {}
  try { db.exec(`ALTER TABLE game_stats ADD COLUMN dice_failures INTEGER DEFAULT 0`) } catch (e) {}
  try { db.exec(`ALTER TABLE game_stats ADD COLUMN images_generated INTEGER DEFAULT 0`) } catch (e) {}
  console.log(`Database ready: ${DB_PATH}`)
} catch (err) {
  console.error('Database init error:', err.message)
  db = null
}

const app = express()
app.use(express.json({ limit: '10mb' }))

// Descomentar (o TRUST_PROXY=true) cuando el servidor corre detrás de un proxy inverso
// para que rate limiting e IP de stats usen la IP real del cliente
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1)
}

// --- Rate limiting (protege la API key del servidor contra abuso) ---
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Inténtalo de nuevo en un minuto.' },
})

const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Inténtalo de nuevo en un minuto.' },
})

// --- Auth opcional: si AUTH_TOKEN está definido, los proxies lo exigen ---
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''

function requireAuthToken(req, res, next) {
  if (!AUTH_TOKEN) return next()
  const header = req.headers.authorization || ''
  if (header !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Token de autenticación inválido' })
  }
  next()
}

// --- Validación de payloads del proxy (whitelist, nunca reenvío arbitrario) ---
const MAX_MESSAGES = 200
const MAX_MESSAGE_CHARS = 100_000
const MAX_ATTACHMENT_CHARS = 8_000_000

function sanitizeApiMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null
  const clean = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null
    if (!['system', 'user', 'assistant'].includes(m.role)) return null
    let content
    if (typeof m.content === 'string') {
      content = m.content.slice(0, MAX_MESSAGE_CHARS)
    } else if (Array.isArray(m.content)) {
      if (m.content.length > 20) return null
      content = m.content.map((part) => {
        if (part?.type === 'text' && typeof part.text === 'string') {
          return { type: 'text', text: part.text.slice(0, MAX_MESSAGE_CHARS) }
        }
        if (part?.type === 'image_url' && typeof part.image_url?.url === 'string') {
          const url = part.image_url.url
          if (url.length > MAX_ATTACHMENT_CHARS) return null
          return { type: 'image_url', image_url: { url } }
        }
        return null
      })
      if (content.some((p) => p === null)) return null
    } else {
      return null
    }
    clean.push({ role: m.role, content })
  }
  return clean
}

function validateChatBody(req, res, next) {
  const b = req.body || {}
  const messages = sanitizeApiMessages(b.messages)
  if (!messages) {
    return res.status(400).json({ error: 'Payload inválido: campo "messages" requerido (array de {role, content})' })
  }
  req.body = {
    model: typeof b.model === 'string' ? b.model.slice(0, 200) : 'gpt-4o-mini',
    messages,
    temperature: Number.isFinite(b.temperature) ? Math.min(2, Math.max(0, b.temperature)) : 0.8,
    ...(b.max_tokens !== undefined && Number.isInteger(b.max_tokens) && b.max_tokens > 0
      ? { max_tokens: Math.min(32768, b.max_tokens) }
      : {}),
    ...(b.stream === true ? { stream: true } : {}),
  }
  next()
}

function validateTtsBody(req, res, next) {
  const b = req.body || {}
  if (typeof b.input !== 'string' || !b.input.trim()) {
    return res.status(400).json({ error: 'Campo "input" requerido' })
  }
  req.body = {
    model: typeof b.model === 'string' ? b.model.slice(0, 200) : 'tts-1',
    input: b.input.slice(0, 4096),
    voice: typeof b.voice === 'string' ? b.voice.slice(0, 100) : 'alloy',
    ...(Number.isFinite(b.speed) ? { speed: Math.min(4, Math.max(0.25, b.speed)) } : {}),
    ...(typeof b.response_format === 'string' ? { response_format: b.response_format.slice(0, 40) } : {}),
  }
  next()
}

function validateImageBody(req, res, next) {
  const b = req.body || {}
  if (typeof b.prompt !== 'string' || !b.prompt.trim()) {
    return res.status(400).json({ error: 'Campo "prompt" requerido' })
  }
  req.body = {
    model: typeof b.model === 'string' ? b.model.slice(0, 200) : 'flux-2-klein',
    prompt: b.prompt.slice(0, 2000),
    ...(typeof b.size === 'string' ? { size: b.size.slice(0, 40) } : {}),
    ...(Number.isInteger(b.n) && b.n > 0 ? { n: Math.min(4, b.n) } : {}),
  }
  next()
}

app.use(express.static(resolve(__dirname, 'dist'), { index: 'index.html' }))

function stripKeys(config) {
  return {
    ai: { ...config.ai, apiKey: '' },
    image: config.image ? { ...config.image, apiKey: '' } : { endpoint: '', apiKey: '', model: 'flux-2-klein', size: '1024x1024' },
    tts: { ...config.tts, apiKey: '' },
  }
}

app.get('/api/guest-config', (_req, res) => {
  res.json({ ...stripKeys(serverConfig), authRequired: Boolean(AUTH_TOKEN) })
})

function upstreamError(res, status, detail, label) {
  console.error(`[${label}] upstream ${status}: ${String(detail).slice(0, 500)}`)
  const forward = status >= 400 && status < 600 ? status : 502
  res.status(forward).json({ error: 'El proveedor de IA devolvió un error. Revisa la configuración del servidor.' })
}

app.post('/api/proxy/chat', proxyLimiter, requireAuthToken, validateChatBody, async (req, res) => {
  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      return res.status(500).json({ error: 'API key no configurada en el servidor' })
    }

    const isStream = req.body.stream === true

    const response = await fetch(`${serverConfig.ai.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(isStream ? 300_000 : 120_000),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      return upstreamError(res, response.status, errBody, 'proxy/chat')
    }

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const nodeStream = Readable.fromWeb(response.body)
      req.on('close', () => nodeStream.destroy())
      nodeStream.on('error', () => res.end())
      nodeStream.pipe(res)
    } else {
      const data = await response.json()
      res.status(response.status).json(data)
    }
  } catch (err) {
    console.error('[proxy/chat] fetch failed:', err.message)
    res.status(502).json({ error: 'No se pudo contactar con el proveedor de IA' })
  }
})

app.post('/api/proxy/tts', proxyLimiter, requireAuthToken, validateTtsBody, async (req, res) => {
  try {
    const apiKey = getTtsApiKey()
    if (!apiKey) {
      return res.status(500).json({ error: 'API key de TTS no configurada en el servidor' })
    }

    const response = await fetch(`${serverConfig.tts.endpoint}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(60_000),
    })

    const buffer = await response.arrayBuffer()
    res.status(response.status).set(response.headers.get('content-type') ? { 'Content-Type': response.headers.get('content-type') } : {}).send(Buffer.from(buffer))
  } catch (err) {
    console.error('[proxy/tts] fetch failed:', err.message)
    res.status(502).json({ error: 'No se pudo contactar con el proveedor de TTS' })
  }
})

app.post('/api/proxy/image', proxyLimiter, requireAuthToken, validateImageBody, async (req, res) => {
  try {
    const apiKey = getImageApiKey()
    if (!apiKey) {
      return res.status(500).json({ error: 'API key de imágenes no configurada en el servidor' })
    }

    const endpoint = serverConfig.image?.endpoint || serverConfig.ai.endpoint
    const response = await fetch(`${endpoint}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      return upstreamError(res, response.status, errBody, 'proxy/image')
    }

    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('[proxy/image] fetch failed:', err.message)
    res.status(502).json({ error: 'No se pudo contactar con el proveedor de imágenes' })
  }
})

// --- Stats API — upsert by session_id ---
function toInt(value, min, max, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

app.post('/api/stats', statsLimiter, (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not available' })
  try {
    const {
      username, adventureName, sessionId,
      level, xpTotal, enemiesDefeated, timePlayedMs,
      result, messagesSent, diceRolls, diceSuccesses, diceFailures, imagesGenerated,
    } = req.body
    if (typeof username !== 'string' || username.length > 40) {
      return res.status(400).json({ error: 'Campo "username" inválido' })
    }
    if (sessionId !== undefined && (typeof sessionId !== 'string' || sessionId.length > 64)) {
      return res.status(400).json({ error: 'Campo "sessionId" inválido' })
    }
    const ip = req.ip || req.socket.remoteAddress || ''
    const stmt = db.prepare(`
      INSERT INTO game_stats (session_id, username, adventure_name, ip, level, xp_total, enemies_defeated, time_played_ms, messages_sent, dice_rolls, dice_successes, dice_failures, images_generated, result, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(session_id) DO UPDATE SET
        level = excluded.level,
        xp_total = excluded.xp_total,
        enemies_defeated = excluded.enemies_defeated,
        time_played_ms = excluded.time_played_ms,
        messages_sent = excluded.messages_sent,
        dice_rolls = excluded.dice_rolls,
        dice_successes = excluded.dice_successes,
        dice_failures = excluded.dice_failures,
        images_generated = excluded.images_generated,
        result = CASE WHEN excluded.result != 'active' THEN excluded.result ELSE game_stats.result END,
        updated_at = datetime('now')
    `)
    const resultStmt = stmt.run(
      sessionId || randomUUID(),
      username.trim() || 'anon', String(adventureName || '').slice(0, 120), ip,
      toInt(level, 1, 100, 1),
      toInt(xpTotal, 0, 1_000_000_000),
      toInt(enemiesDefeated, 0, 1_000_000),
      toInt(timePlayedMs, 0, 1_000_000_000_000),
      toInt(messagesSent, 0, 10_000_000),
      toInt(diceRolls, 0, 10_000_000),
      toInt(diceSuccesses, 0, 10_000_000),
      toInt(diceFailures, 0, 10_000_000),
      toInt(imagesGenerated, 0, 1_000_000),
      ['active', 'success', 'failure'].includes(result) ? result : 'active',
    )
    res.json({ ok: true, id: resultStmt.lastInsertRowid })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/leaderboard', statsLimiter, (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not available' })
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)
    const rows = db.prepare(`
      SELECT username, adventure_name, level, xp_total, enemies_defeated, time_played_ms, messages_sent, dice_rolls, dice_successes, dice_failures, result, created_at
      FROM game_stats
      ORDER BY xp_total DESC, level DESC
      LIMIT ?
    `).all(limit)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.use((_req, res) => {
  res.sendFile(resolve(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://0.0.0.0:${PORT}`)
  console.log(`Config file: ${CONFIG_PATH}`)
  console.log(`Database: ${DB_PATH}`)
  console.log(`API key set: ${getApiKey() ? 'Yes' : 'No'}`)
  console.log(`TTS API key set: ${getTtsApiKey() ? 'Yes' : 'No'}`)
})