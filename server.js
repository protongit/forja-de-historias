import { Readable } from 'stream'
import { randomUUID } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
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

app.use(express.static(resolve('./dist'), { index: 'index.html' }))

function stripKeys(config) {
  return {
    ai: { ...config.ai, apiKey: '' },
    image: config.image ? { ...config.image, apiKey: '' } : { endpoint: '', apiKey: '', model: 'flux-2-klein', size: '1024x1024' },
    tts: { ...config.tts, apiKey: '' },
  }
}

app.get('/api/guest-config', (_req, res) => {
  res.json(stripKeys(serverConfig))
})

app.post('/api/proxy/chat', async (req, res) => {
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
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      return res.status(response.status).json({ error: errBody || response.statusText })
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
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/proxy/tts', async (req, res) => {
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
    })

    const buffer = await response.arrayBuffer()
    res.status(response.status).set(response.headers.get('content-type') ? { 'Content-Type': response.headers.get('content-type') } : {}).send(Buffer.from(buffer))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/proxy/image', async (req, res) => {
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
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      return res.status(response.status).json({ error: errBody || response.statusText })
    }

    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Stats API — upsert by session_id
app.post('/api/stats', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not available' })
  try {
    const {
      username, adventureName, sessionId,
      level, xpTotal, enemiesDefeated, timePlayedMs,
      result, messagesSent, diceRolls, diceSuccesses, diceFailures, imagesGenerated,
    } = req.body
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
      username || 'anon', adventureName || '', ip,
      level || 1, xpTotal || 0, enemiesDefeated || 0, timePlayedMs || 0,
      messagesSent || 0, diceRolls || 0, diceSuccesses || 0, diceFailures || 0, imagesGenerated || 0,
      result || 'active',
    )
    res.json({ ok: true, id: resultStmt.lastInsertRowid })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/leaderboard', (req, res) => {
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
  res.sendFile(resolve('./dist/index.html'))
})

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://0.0.0.0:${PORT}`)
  console.log(`Config file: ${CONFIG_PATH}`)
  console.log(`Database: ${DB_PATH}`)
  console.log(`API key set: ${getApiKey() ? 'Yes' : 'No'}`)
  console.log(`TTS API key set: ${getTtsApiKey() ? 'Yes' : 'No'}`)
})