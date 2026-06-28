import type { Enemy, CharacterStat, CharacterSkill, JournalEventType, TTSVoiceEmotion } from '../types/game'
import type { GameAction } from '../types/game'

const BRACKET_GROUP = '(ADD_ITEM|REMOVE_ITEM|SETUP_COMPLETE|GENERATION_COMPLETE|QUEST_COMPLETE|DICE_CHECK|COMBAT_START|COMBAT_END|ENEMY_DAMAGE|ENEMY_HEAL|ADD_XP|LEVEL_UP|ADD_COMPANION|REMOVE_COMPANION|COMPANION_ACTION|JOURNAL_ENTRY|DISCOVER|TONE|ADD_ENEMY|REMOVE_ENEMY|PLAYER_DAMAGE|PLAYER_HEAL|SET_PLAYER_HP|DICE_RESULT|IMAGE|IMG|OBJECTIVE_COMPLETE|ADD_OBJECTIVE|SET_LOCATION|DISCOVER_LOCATION|ADD_NPC|UPDATE_NPC|REMOVE_NPC|SET_TIME|SET_WEATHER)'

const COMMAND_REGEX = new RegExp(`\\[{1,2}(${BRACKET_GROUP}(?:\\:\\s*[^\\]]*)?)\\]{1,2}`, 'gi')
const CONTENT_MARKERS_REGEX = /\[\/?(CHARACTER|QUEST|STATS|SKILLS)\]/gi

export function cleanBracketCommands(text: string): string {
  return text.replace(COMMAND_REGEX, '').trim()
}

export function cleanContentMarkers(text: string): string {
  return text.replace(CONTENT_MARKERS_REGEX, '').trim()
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
  let cleaned = raw

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
  const diceRegex = /\[{1,2}DICE_CHECK:\s*stat:\s*(.+?),\s*dc:\s*(\d+),\s*dice:\s*(d\d+)\]{1,2}/i
  const diceMatch = cleaned.match(diceRegex)
  if (diceMatch) {
    actions.push({
      type: 'SET_DICE_CHECK',
      check: { stat: diceMatch[1].trim(), dc: parseInt(diceMatch[2], 10), dice: diceMatch[3].trim(), resolved: false },
    })
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

  // --- ENEMY_DAMAGE / ENEMY_HEAL ---
  const enemyDamageRegex = /\[{1,2}ENEMY_DAMAGE:\s*(.+?),\s*(\d+)\]{1,2}/i
  const enemyDmg = cleaned.match(enemyDamageRegex)
  if (enemyDmg) actions.push({ type: 'UPDATE_ENEMY', name: enemyDmg[1].trim(), updates: { hp: Math.max(0, parseInt(enemyDmg[2])) } })

  const enemyHealRegex = /\[{1,2}ENEMY_HEAL:\s*(.+?),\s*(\d+)\]{1,2}/i
  const enemyHeal = cleaned.match(enemyHealRegex)
  if (enemyHeal) actions.push({ type: 'UPDATE_ENEMY', name: enemyHeal[1].trim(), updates: { hp: Math.min(999, parseInt(enemyHeal[2])) } })

  // --- ADD_XP / LEVEL_UP ---
  const xpRegex = /\[{1,2}ADD_XP:\s*(\d+)\]{1,2}/i
  const xpMatch = cleaned.match(xpRegex)
  if (xpMatch) {
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

  const levelUpRegex = /\[{1,2}LEVEL_UP\]{1,2}/i
  if (levelUpRegex.test(cleaned)) {
    const newLevel = Math.min(100, currentLevel + 1)
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

  // --- Companion commands ---
  const addCompanionRegex = /\[{1,2}ADD_COMPANION:\s*(.+?),\s*(.+?),\s*stats:\s*(.+?)\]{1,2}/i
  const addComp = cleaned.match(addCompanionRegex)
  if (addComp) {
    const stats = addComp[3].trim().split(',').map((s) => {
      const p = s.split(':').map((x) => x.trim())
      return { name: p[0], value: parseInt(p[1]) || 1 }
    }).filter((s) => s.name)
    actions.push({
      type: 'ADD_COMPANION',
      companion: { name: addComp[1].trim(), description: addComp[2].trim(), stats, isActive: true },
    })
  }

  const removeComp = /\[{1,2}REMOVE_COMPANION:\s*(.+?)\]{1,2}/i
  const rmComp = cleaned.match(removeComp)
  if (rmComp) actions.push({ type: 'REMOVE_COMPANION', name: rmComp[1].trim() })

  // --- Journal commands ---
  const journalEntryRegex = /\[{1,2}JOURNAL_ENTRY:\s*(.+?),\s*(.+?),\s*(.+?)\]{1,2}/i
  const je = cleaned.match(journalEntryRegex)
  if (je) {
    actions.push({
      type: 'ADD_JOURNAL_ENTRY',
      entry: { id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: je[1].trim(), summary: je[2].trim(), timestamp: Date.now(), eventType: (je[3].trim() as JournalEventType) || 'discovery', isFavorite: false },
    })
    actions.push({
      type: 'ADD_NOTIFICATION',
      notification: {
        id: notifId(),
        type: 'quest',
        message: `📖 Diario: ${je[1].trim()}`,
        timestamp: Date.now(),
      },
    })
  }

  const discoverRegex = /\[{1,2}DISCOVER:\s*(.+?)\]{1,2}/i
  const disc = cleaned.match(discoverRegex)
  if (disc) {
    actions.push({
      type: 'ADD_JOURNAL_ENTRY',
      entry: { id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: `Descubrimiento: ${disc[1].trim()}`, summary: `Has descubierto ${disc[1].trim()}`, timestamp: Date.now(), eventType: 'discovery', isFavorite: false },
    })
  }

  // --- OBJECTIVE commands ---
  const objectiveCompleteRegex = /\[{1,2}OBJECTIVE_COMPLETE:\s*(.+?)\]{1,2}/i
  const oc = cleaned.match(objectiveCompleteRegex)
  if (oc) actions.push({ type: 'COMPLETE_OBJECTIVE', name: oc[1].trim() })

  const addObjectiveRegex = /\[{1,2}ADD_OBJECTIVE:\s*(.+?)\]{1,2}/i
  const ao = cleaned.match(addObjectiveRegex)
  if (ao) actions.push({ type: 'ADD_OBJECTIVE', objective: { name: ao[1].trim(), completed: false } })

  // --- WORLD commands ---
  const setLocationRegex = /\[{1,2}SET_LOCATION:\s*(.+?)\]{1,2}/i
  const sl = cleaned.match(setLocationRegex)
  if (sl) actions.push({ type: 'SET_CURRENT_LOCATION', name: sl[1].trim() })

  const discoverLocationRegex = /\[{1,2}DISCOVER_LOCATION:\s*(.+?),\s*(.+?)\]{1,2}/i
  const dl = cleaned.match(discoverLocationRegex)
  if (dl) {
    actions.push({
      type: 'ADD_LOCATION',
      location: { name: dl[1].trim(), description: dl[2].trim(), discovered: true, exits: [] },
    })
  }

  const addNpcRegex = /\[{1,2}ADD_NPC:\s*(.+?),\s*(.+?),\s*(.+?),\s*(-?\d+)\]{1,2}/i
  const an = cleaned.match(addNpcRegex)
  if (an) {
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

  const updateNpcRegex = /\[{1,2}UPDATE_NPC:\s*(.+?),\s*(.+?),\s*(.+?)\]{1,2}/i
  const un = cleaned.match(updateNpcRegex)
  if (un) {
    const field = un[2].trim()
    const value = un[3].trim()
    let updates: Record<string, unknown>
    if (field === 'relationship' || field === 'attitude') updates = { [field]: parseInt(value, 10) }
    else if (field === 'isAlive') updates = { [field]: value === 'true' }
    else updates = { [field]: value }
    actions.push({ type: 'UPDATE_WORLD_NPC', name: un[1].trim(), updates: updates as Partial<import('../types/game').WorldNPC> })
  }

  const removeNpcRegex = /\[{1,2}REMOVE_NPC:\s*(.+?)\]{1,2}/i
  const rn = cleaned.match(removeNpcRegex)
  if (rn) actions.push({ type: 'REMOVE_WORLD_NPC', name: rn[1].trim() })

  const setTimeRegex = /\[{1,2}SET_TIME:\s*(.+?)\]{1,2}/i
  const st = cleaned.match(setTimeRegex)
  if (st) {
    const valid = ['amanecer', 'mañana', 'tarde', 'atardecer', 'noche']
    const t = st[1].trim().toLowerCase()
    if (valid.includes(t)) actions.push({ type: 'SET_TIME_OF_DAY', time: t as import('../types/game').WorldState['timeOfDay'] })
  }

  const setWeatherRegex = /\[{1,2}SET_WEATHER:\s*(.+?)\]{1,2}/i
  const sw = cleaned.match(setWeatherRegex)
  if (sw) actions.push({ type: 'SET_WEATHER', weather: sw[1].trim() })

  // --- TONE command ---
  const toneRegex = /\[{1,2}TONE:\s*(.+?)\]{1,2}/i
  const tone = cleaned.match(toneRegex)
  if (tone) {
    const em = tone[1].trim().toLowerCase()
    const valid = ['neutral', 'grave', 'alegre', 'epico', 'misterioso', 'susurro', 'terrorifico']
    if (valid.includes(em)) actions.push({ type: 'TTS_SET_EMOTION', emotion: em as TTSVoiceEmotion })
  }

  // --- Player HP commands ---
  const playerDamageRegex = /\[{1,2}PLAYER_DAMAGE:\s*(\d+)\]{1,2}/i
  const playerDmg = cleaned.match(playerDamageRegex)
  if (playerDmg) {
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

  const playerHealRegex = /\[{1,2}PLAYER_HEAL:\s*(\d+)\]{1,2}/i
  const playerHeal = cleaned.match(playerHealRegex)
  if (playerHeal) {
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

  const setPlayerHpRegex = /\[{1,2}SET_PLAYER_HP:\s*(\d+)\s*,\s*(\d+)\]{1,2}/i
  const setHp = cleaned.match(setPlayerHpRegex)
  if (setHp) {
    actions.push({ type: 'SET_PLAYER_HP', hp: parseInt(setHp[1], 10), maxHp: parseInt(setHp[2], 10) })
  }

  // --- IMAGE GENERATION ---
  const pendingImages: { prompt: string }[] = []
  const imagenRegex = /\[{1,2}(IMAGE|IMG):\s*(.+?)\]{1,2}/gi
  let imgMatch
  while ((imgMatch = imagenRegex.exec(cleaned)) !== null) {
    pendingImages.push({ prompt: imgMatch[2].trim() })
    cleaned = cleaned.replace(imgMatch[0], '')
  }

  cleaned = cleanBracketCommands(cleaned)
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
