import type { Enemy, CharacterStat, CharacterSkill, JournalEventType, TTSVoiceEmotion } from '../types/game'
import type { GameAction } from '../types/game'

const BRACKET_GROUP = '(ADD_ITEM|REMOVE_ITEM|SETUP_COMPLETE|GENERATION_COMPLETE|QUEST_COMPLETE|DICE_CHECK|COMBAT_START|COMBAT_END|ENEMY_DAMAGE|ENEMY_HEAL|ADD_XP|LEVEL_UP|ADD_COMPANION|REMOVE_COMPANION|COMPANION_ACTION|JOURNAL_ENTRY|DISCOVER|TONE|ADD_ENEMY|REMOVE_ENEMY|PLAYER_DAMAGE|PLAYER_HEAL|SET_PLAYER_HP|DICE_RESULT|IMAGE|IMG|OBJECTIVE_COMPLETE|ADD_OBJECTIVE|SET_LOCATION|DISCOVER_LOCATION|ADD_NPC|UPDATE_NPC|REMOVE_NPC|SET_TIME|SET_WEATHER)'

const COMMAND_REGEX = new RegExp(`\\[{1,2}(${BRACKET_GROUP}(?:\\:\\s*[^\\]]*)?)\\]{1,2}`, 'gi')
const CONTENT_MARKERS_REGEX = /\[\/?(CHARACTER|QUEST|STATS|SKILLS)\]/gi
// Bloques de datos estructurados (se muestran en los paneles, no en la narrativa)
const CONTENT_BLOCKS_REGEX = /\[(CHARACTER|QUEST|STATS|SKILLS)\][\s\S]*?\[\/\1\]/gi

export function cleanBracketCommands(text: string): string {
  return text.replace(COMMAND_REGEX, '').trim()
}

export function cleanContentMarkers(text: string): string {
  return text
    .replace(CONTENT_BLOCKS_REGEX, '')
    .replace(CONTENT_MARKERS_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Algunos proveedores devuelven avisos de moderación/error en inglés dentro del
// texto de la respuesta. Los eliminamos y avisamos al jugador.
const PROVIDER_NOTICE_REGEX = /^.*(?:request was rejected|considered high risk|content (?:policy|filter)|prohibited content|flagged as potentially).*$/gim

export function stripProviderNotices(text: string): { text: string; rejected: boolean } {
  let rejected = false
  const out = text
    .replace(/[⚑⚠]/g, '')
    .replace(PROVIDER_NOTICE_REGEX, () => {
      rejected = true
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text: out, rejected }
}

let notifCounter = 0
function notifId(): string {
  return `notif-${Date.now()}-${++notifCounter}`
}

export interface ProcessedResponse {
  cleaned: string
  actions: GameAction[]
  pendingImages: { prompt: string }[]
}

export function processRawResponse(raw: string, currentLevel: number): ProcessedResponse {
  const actions: GameAction[] = []
  // Ciertos modelos alucinan un prefijo "$" en los comandos: [[$DICE_CHECK: ...]]
  let cleaned = raw.replace(/([[［]{1,2})\s*\$\s*/g, '$1')

  // --- ITEM commands ---
  const addRegex = /\[{1,2}ADD_ITEM:\s*(.+?)\]{1,2}/gi
  const removeRegex = /\[{1,2}REMOVE_ITEM:\s*(.+?)\]{1,2}/gi
  let match
  while ((match = addRegex.exec(cleaned)) !== null) {
    const itemName = match[1].trim()
    actions.push({ type: 'ADD_ITEM', item: itemName })
    actions.push({
      type: 'ADD_NOTIFICATION',
      notification: {
        id: notifId(),
        type: 'item',
        message: `🎒 Has obtenido: ${itemName}`,
        timestamp: Date.now(),
      },
    })
  }
  while ((match = removeRegex.exec(cleaned)) !== null) {
    actions.push({ type: 'REMOVE_ITEM', item: match[1].trim() })
  }

  // --- DICE command ---
  const diceRegex = /\[{1,2}DICE_CHECK[：:]\s*stat[：:]\s*(.+?),\s*dc[：:]\s*(\d+),\s*dice[：:]\s*(d\d+)\]{1,2}/i
  const diceMatch = cleaned.match(diceRegex)
  if (diceMatch) {
    actions.push({
      type: 'SET_DICE_CHECK',
      check: { stat: diceMatch[1].trim(), dc: parseInt(diceMatch[2], 10), dice: diceMatch[3].trim(), resolved: false },
    })
  }

  // --- QUEST_COMPLETE (resultado explícito opcional: exito | fracaso) ---
  const questCompleteRegex = /\[{1,2}QUEST_COMPLETE(?::\s*(exito|éxito|success|fracaso|failure))?\]{1,2}/i
  const questComplete = cleaned.match(questCompleteRegex)
  if (questComplete) {
    const outcome = (questComplete[1] || '').trim().toLowerCase()
    if (outcome) {
      const failure = outcome.startsWith('fracaso') || outcome.startsWith('failure')
      actions.push({ type: 'SET_ADVENTURE_RESULT', result: failure ? 'failure' : 'success' })
    }
  }

  // --- COMBAT_START ---
  const combatStartRegex = /\[{1,2}COMBAT_START:\s*enemigos:\s*(.+?)\]{1,2}/i
  const combatStartMatch = cleaned.match(combatStartRegex)
  if (combatStartMatch) {
    const enemies = combatStartMatch[1].trim().split(',').map((e) => e.trim()).filter(Boolean).map((e) => {
      const parts = e.split('|').map((p) => p.trim())
      return {
        name: parts[0] || 'Enemigo', hp: parseInt(parts[1]) || 10, maxHp: parseInt(parts[1]) || 10,
        ac: parseInt(parts[2]) || 10, isAlive: true, description: parts[3] || '',
      } as Enemy
    })
    if (enemies.length > 0) {
      actions.push({ type: 'SET_ENEMIES', enemies })
      actions.push({ type: 'SET_COMBAT_ACTIVE', active: true })
      actions.push({ type: 'SET_COMBAT_TURN', turn: 1 })
    }
  }

  // --- ENEMY_DAMAGE / ENEMY_HEAL (name captured greedily: it may contain commas) ---
  const enemyDamageRegex = /\[{1,2}ENEMY_DAMAGE:\s*(.+),\s*(\d+)\]{1,2}/gi
  for (const enemyDmg of cleaned.matchAll(enemyDamageRegex)) {
    actions.push({ type: 'UPDATE_ENEMY', name: enemyDmg[1].trim(), updates: { hp: Math.max(0, parseInt(enemyDmg[2])) } })
  }

  const enemyHealRegex = /\[{1,2}ENEMY_HEAL:\s*(.+),\s*(\d+)\]{1,2}/gi
  for (const enemyHeal of cleaned.matchAll(enemyHealRegex)) {
    actions.push({ type: 'UPDATE_ENEMY', name: enemyHeal[1].trim(), updates: { hp: Math.min(999, parseInt(enemyHeal[2])) } })
  }

  // --- ADD_XP / LEVEL_UP ---
  const xpRegex = /\[{1,2}ADD_XP:\s*(\d+)\]{1,2}/gi
  for (const xpMatch of cleaned.matchAll(xpRegex)) {
    const amount = parseInt(xpMatch[1], 10)
    actions.push({ type: 'ADD_XP', amount })
    actions.push({
      type: 'ADD_NOTIFICATION',
      notification: {
        id: notifId(),
        type: 'xp',
        message: `✨ +${amount} XP`,
        timestamp: Date.now(),
      },
    })
  }

  const levelUpRegex = /\[{1,2}LEVEL_UP\]{1,2}/gi
  const levelUps = cleaned.match(levelUpRegex)?.length ?? 0
  if (levelUps > 0) {
    const newLevel = Math.min(100, currentLevel + levelUps)
    actions.push({ type: 'SET_LEVEL', level: newLevel })
    actions.push({
      type: 'ADD_NOTIFICATION',
      notification: {
        id: notifId(),
        type: 'levelup',
        message: `🌟 ¡Subes al nivel ${newLevel}!`,
        timestamp: Date.now(),
      },
    })
  }

  // --- COMBAT_END ---
  const combatEndRegex = /\[{1,2}COMBAT_END(?::\s*count:\s*(\d+))?\]{1,2}/i
  const combatEndMatch = cleaned.match(combatEndRegex)
  if (combatEndMatch) {
    const defeated = combatEndMatch[1] ? parseInt(combatEndMatch[1], 10) : 0
    actions.push({ type: 'SET_COMBAT_ACTIVE', active: false })
    actions.push({ type: 'SET_COMBAT_TURN', turn: 0 })
    actions.push({ type: 'SET_ENEMIES', enemies: [] })
    if (defeated > 0) {
      for (let i = 0; i < defeated; i++) {
        actions.push({ type: 'INCREMENT_STAT', stat: 'enemiesDefeated' })
      }
    }
  }

  // --- Companion commands (description may contain commas → greedy until ", stats:") ---
  const addCompanionRegex = /\[{1,2}ADD_COMPANION:\s*(.+?),\s*(.+),\s*stats:\s*(.+?)\]{1,2}/gi
  for (const addComp of cleaned.matchAll(addCompanionRegex)) {
    const stats = addComp[3].trim().split(',').map((s) => {
      const p = s.split(':').map((x) => x.trim())
      return { name: p[0], value: parseInt(p[1]) || 1 }
    }).filter((s) => s.name)
    actions.push({
      type: 'ADD_COMPANION',
      companion: { name: addComp[1].trim(), description: addComp[2].trim(), stats, isActive: true },
    })
  }

  const removeCompRegex = /\[{1,2}REMOVE_COMPANION:\s*(.+?)\]{1,2}/gi
  for (const rmComp of cleaned.matchAll(removeCompRegex)) {
    actions.push({ type: 'REMOVE_COMPANION', name: rmComp[1].trim() })
  }

  // --- Journal commands (summary may contain commas; optional type at the end) ---
  const JOURNAL_EVENT_TYPES = 'discovery|encounter|dialog|achievement|milestone'
  const journalEntryRegex = /\[{1,2}JOURNAL_ENTRY:\s*([\s\S]+?)\]{1,2}/gi
  for (const jeMatch of cleaned.matchAll(journalEntryRegex)) {
    let body = jeMatch[1].trim()
    let eventType: JournalEventType = 'discovery'
    const typeMatch = body.match(new RegExp(`^([\\s\\S]+),\\s*(${JOURNAL_EVENT_TYPES})$`, 'i'))
    if (typeMatch) {
      eventType = typeMatch[2].trim().toLowerCase() as JournalEventType
      body = typeMatch[1].trim()
    }
    const commaIdx = body.indexOf(',')
    const title = commaIdx === -1 ? body : body.slice(0, commaIdx).trim()
    const summary = commaIdx === -1 ? body : body.slice(commaIdx + 1).trim()
    if (!title) continue
    actions.push({
      type: 'ADD_JOURNAL_ENTRY',
      entry: { id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, summary, timestamp: Date.now(), eventType, isFavorite: false },
    })
    actions.push({
      type: 'ADD_NOTIFICATION',
      notification: {
        id: notifId(),
        type: 'quest',
        message: `📖 Diario: ${title}`,
        timestamp: Date.now(),
      },
    })
  }

  const discoverRegex = /\[{1,2}DISCOVER:\s*(.+?)\]{1,2}/gi
  for (const disc of cleaned.matchAll(discoverRegex)) {
    actions.push({
      type: 'ADD_JOURNAL_ENTRY',
      entry: { id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: `Descubrimiento: ${disc[1].trim()}`, summary: `Has descubierto ${disc[1].trim()}`, timestamp: Date.now(), eventType: 'discovery', isFavorite: false },
    })
  }

  // --- OBJECTIVE commands ---
  const objectiveCompleteRegex = /\[{1,2}OBJECTIVE_COMPLETE:\s*(.+?)\]{1,2}/gi
  for (const oc of cleaned.matchAll(objectiveCompleteRegex)) {
    actions.push({ type: 'COMPLETE_OBJECTIVE', name: oc[1].trim() })
  }

  const addObjectiveRegex = /\[{1,2}ADD_OBJECTIVE:\s*(.+?)\]{1,2}/gi
  for (const ao of cleaned.matchAll(addObjectiveRegex)) {
    actions.push({ type: 'ADD_OBJECTIVE', objective: { name: ao[1].trim(), completed: false } })
  }

  // --- WORLD commands (descriptions may contain commas → greedy tail fields) ---
  const setLocationRegex = /\[{1,2}SET_LOCATION:\s*(.+?)\]{1,2}/gi
  for (const sl of cleaned.matchAll(setLocationRegex)) {
    actions.push({ type: 'SET_CURRENT_LOCATION', name: sl[1].trim() })
  }

  const discoverLocationRegex = /\[{1,2}DISCOVER_LOCATION:\s*(.+?),\s*(.+?)\]{1,2}/gi
  for (const dl of cleaned.matchAll(discoverLocationRegex)) {
    actions.push({
      type: 'ADD_LOCATION',
      location: { name: dl[1].trim(), description: dl[2].trim(), discovered: true, exits: [] },
    })
  }

  const addNpcRegex = /\[{1,2}ADD_NPC:\s*(.+?),\s*(.+),\s*([^,]+?),\s*(-?\d+)\]{1,2}/gi
  for (const an of cleaned.matchAll(addNpcRegex)) {
    actions.push({
      type: 'ADD_WORLD_NPC',
      npc: {
        name: an[1].trim(),
        description: an[2].trim(),
        location: an[3].trim(),
        attitude: parseInt(an[4], 10),
        isAlive: true,
        relationship: parseInt(an[4], 10),
      },
    })
  }

  // value (last field) captured greedily so it may contain commas
  const updateNpcRegex = /\[{1,2}UPDATE_NPC:\s*(.+?),\s*([^,]+?),\s*(.+?)\]{1,2}/gi
  for (const un of cleaned.matchAll(updateNpcRegex)) {
    const field = un[2].trim()
    const value = un[3].trim()
    let updates: Record<string, unknown>
    if (field === 'relationship' || field === 'attitude') updates = { [field]: parseInt(value, 10) }
    else if (field === 'isAlive') updates = { [field]: value === 'true' }
    else updates = { [field]: value }
    actions.push({ type: 'UPDATE_WORLD_NPC', name: un[1].trim(), updates: updates as Partial<import('../types/game').WorldNPC> })
  }

  const removeNpcRegex = /\[{1,2}REMOVE_NPC:\s*(.+?)\]{1,2}/gi
  for (const rn of cleaned.matchAll(removeNpcRegex)) {
    actions.push({ type: 'REMOVE_WORLD_NPC', name: rn[1].trim() })
  }

  const setTimeRegex = /\[{1,2}SET_TIME:\s*(.+?)\]{1,2}/gi
  for (const st of cleaned.matchAll(setTimeRegex)) {
    const valid = ['amanecer', 'mañana', 'tarde', 'atardecer', 'noche']
    const t = st[1].trim().toLowerCase()
    if (valid.includes(t)) actions.push({ type: 'SET_TIME_OF_DAY', time: t as import('../types/game').WorldState['timeOfDay'] })
  }

  const setWeatherRegex = /\[{1,2}SET_WEATHER:\s*(.+?)\]{1,2}/gi
  for (const sw of cleaned.matchAll(setWeatherRegex)) {
    actions.push({ type: 'SET_WEATHER', weather: sw[1].trim() })
  }

  // --- TONE command (el último tono válido gana) ---
  const toneRegex = /\[{1,2}TONE:\s*(.+?)\]{1,2}/gi
  for (const tone of cleaned.matchAll(toneRegex)) {
    const em = tone[1].trim().toLowerCase()
    const valid = ['neutral', 'grave', 'alegre', 'epico', 'misterioso', 'susurro', 'terrorifico']
    if (valid.includes(em)) actions.push({ type: 'TTS_SET_EMOTION', emotion: em as TTSVoiceEmotion })
  }

  // --- Player HP commands ---
  const playerDamageRegex = /\[{1,2}PLAYER_DAMAGE:\s*(\d+)\]{1,2}/gi
  for (const playerDmg of cleaned.matchAll(playerDamageRegex)) {
    const dmg = parseInt(playerDmg[1], 10)
    actions.push({ type: 'UPDATE_PLAYER_HP', delta: -dmg })
    actions.push({
      type: 'ADD_NOTIFICATION',
      notification: {
        id: notifId(),
        type: 'damage',
        message: `💔 -${dmg} HP`,
        timestamp: Date.now(),
      },
    })
  }

  const playerHealRegex = /\[{1,2}PLAYER_HEAL:\s*(\d+)\]{1,2}/gi
  for (const playerHeal of cleaned.matchAll(playerHealRegex)) {
    const heal = parseInt(playerHeal[1], 10)
    actions.push({ type: 'UPDATE_PLAYER_HP', delta: heal })
    actions.push({
      type: 'ADD_NOTIFICATION',
      notification: {
        id: notifId(),
        type: 'heal',
        message: `💚 +${heal} HP`,
        timestamp: Date.now(),
      },
    })
  }

  const setPlayerHpRegex = /\[{1,2}SET_PLAYER_HP:\s*(\d+)\s*,\s*(\d+)\]{1,2}/gi
  for (const setHp of cleaned.matchAll(setPlayerHpRegex)) {
    actions.push({ type: 'SET_PLAYER_HP', hp: parseInt(setHp[1], 10), maxHp: parseInt(setHp[2], 10) })
  }

  // --- IMAGE GENERATION ---
  // Acepta variantes comunes de modelos pequeños: corchetes simples o dobles,
  // corchetes anchos ［［...］］, dos puntos ASCII o chinos "：" y prompts multilínea.
  const pendingImages: { prompt: string }[] = []
  const imagenRegex = /[[［]{1,2}(IMAGE|IMG)[：:]\s*([\s\S]+?)[\]］]{1,2}/gi
  const seenPrompts = new Set<string>()
  for (const m of cleaned.matchAll(imagenRegex)) {
    const prompt = m[2].replace(/\s+/g, ' ').trim()
    if (prompt && !seenPrompts.has(prompt.toLowerCase())) {
      seenPrompts.add(prompt.toLowerCase())
      pendingImages.push({ prompt })
    }
  }
  cleaned = cleaned.replace(imagenRegex, '')

  cleaned = cleanBracketCommands(cleaned)
  const notice = stripProviderNotices(cleaned)
  cleaned = notice.text
  if (notice.rejected) {
    actions.push({
      type: 'ADD_MESSAGE',
      message: {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender: 'system',
        content: '⚠️ El proveedor de IA rechazó parte de la respuesta por moderación de contenido. La narración puede estar incompleta; puedes reintentar o reformular tu acción.',
        timestamp: Date.now(),
      },
    })
  }
  return { cleaned, actions, pendingImages }
}

export function parseStats(text: string): CharacterStat[] {
  const match = text.match(/\[STATS\]([\s\S]*?)\[\/STATS\]/)
  if (!match) return []
  return match[1].trim().split('\n').map((line) => {
    const [name, val] = line.split(':').map((s) => s.trim())
    const v = parseInt(val, 10)
    return isNaN(v) ? null : { name, value: v }
  }).filter((s): s is CharacterStat => s !== null)
}

export function parseSkills(text: string): CharacterSkill[] {
  const match = text.match(/\[SKILLS\]([\s\S]*?)\[\/SKILLS\]/)
  if (!match) return []
  return match[1].trim().split('\n').map((line) => {
    const [name, ...desc] = line.split(':').map((s) => s.trim())
    return { name, description: desc.join(':') }
  })
}

// Borra comandos [[...]] completos y corta en marcadores aún incompletos,
// para que el usuario nunca vea comandos crudos durante el streaming.
export function sanitizeStreamingText(raw: string): string {
  let t = raw.replace(/([[［]{1,2})\s*\$\s*/g, '$1')
  t = t.replace(/[[［]{1,2}[A-Z_][A-Z0-9_ ]*(?:[：:][\s\S]*?)?[\]］]{1,2}/gi, '')
  // Opciones {{...}}: quita las completas y corta en la incompleta en curso,
  // para no mostrar llaves crudas durante el streaming.
  t = t.replace(/\{\{[\s\S]*?\}\}/g, '')
  const blockIdx = t.search(/[[［][^a-z0-9]/)
  if (blockIdx !== -1) t = t.slice(0, blockIdx)
  const optIdx = t.search(/\{\{/)
  if (optIdx !== -1) t = t.slice(0, optIdx)
  return t.replace(/\s+$/, '')
}
