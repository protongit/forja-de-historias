import { getSetupPrompt, getGamemasterPrompt, SYSTEM_PROMPTS } from './prompts'
import type { GameState } from '../types/game'

export function buildSystemPrompt(phase: string, ttsEnabled: boolean, combatMode: string): string {
  if (phase === 'setup') return getSetupPrompt(ttsEnabled)
  if (phase === 'generation') return SYSTEM_PROMPTS.generation
  return getGamemasterPrompt(combatMode === 'tactical')
}

const TONE_LABELS: Record<string, string> = {
  neutral: 'Neutral',
  grave: 'Grave y misteriosa',
  alegre: 'Alegre',
  epico: 'Épica',
  misterioso: 'Misteriosa',
  susurro: 'Susurrante',
  terrorifico: 'Terrorífica',
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  neutral: 'Narra con un tono neutral y equilibrado.',
  grave: 'Narra con un tono grave y misterioso. Usa un lenguaje oscuro, pausado y lleno de presagios.',
  alegre: 'Narra con un tono alegre y humorístico. Incluye situaciones cómicas, diálogos divertidos y un lenguaje ligero y desenfadado.',
  epico: 'Narra con un tono épico y grandioso. Usa un lenguaje heroico, solemne y majestuoso. Las descripciones deben inspirar grandeza y emoción.',
  misterioso: 'Narra con un tono misterioso e intrigante. Mantén un aire de incertidumbre y revela información con cuentagotas.',
  susurro: 'Narra con un tono susurrante e íntimo. Usa descripciones detalladas y un ritmo pausado y envolvente.',
  terrorifico: 'Narra con un tono terrorífico. Crea atmósferas de miedo, tensión y horror. Usa un lenguaje que genere angustia y desasosiego.',
}

export const TONE_LABEL_TO_EMOTION: Record<string, string> = {
  'Neutral': 'neutral',
  'Grave y misteriosa': 'grave',
  'Alegre': 'alegre',
  'Épica': 'epico',
  'Misteriosa': 'misterioso',
  'Susurrante': 'susurro',
  'Terrorífica': 'terrorifico',
}

export function resolveToneEmotion(setupAnswers: Record<string, string> | undefined): string | null {
  if (!setupAnswers) return null
  const label = setupAnswers['tono_narrador']
  if (!label) return null
  return TONE_LABEL_TO_EMOTION[label] || null
}

export function buildCharContext(state: GameState): string {
  const { character, quest, inventory, journal, enemies, companions, level, xp, combatActive, combatTurn, worldState, tts } = state
  const parts: string[] = []

  parts.push('## ESTADO ACTUAL DEL JUEGO')
  parts.push('')

  // --- NARRATIVE TONE ---
  const emotion = tts.emotion || 'neutral'
  const label = TONE_LABELS[emotion] || 'Neutral'
  const instruction = TONE_INSTRUCTIONS[emotion] || TONE_INSTRUCTIONS.neutral
  parts.push('### TONO NARRATIVO')
  parts.push(`- Tono seleccionado: ${label}`)
  parts.push(`- Instrucción: ${instruction}`)
  parts.push('')

  // --- CHARACTER SHEET ---
  if (character) {
    parts.push('### FICHA DEL PERSONAJE')
    parts.push(`- Nombre: ${character.name || 'Desconocido'}`)
    parts.push(`- Nivel: ${level} | XP: ${xp}`)
    if (character.maxHp > 0) parts.push(`- HP: ${character.hp}/${character.maxHp}`)
    if (character.background) parts.push(`- Trasfondo: ${character.background}`)
    if (character.traits?.length) parts.push(`- Rasgos: ${character.traits.join(', ')}`)
    if (character.equipment?.length) parts.push(`- Equipo inicial: ${character.equipment.join(', ')}`)

    if (character.stats?.length) {
      parts.push('')
      parts.push('#### Estadísticas')
      parts.push(character.stats.map((s) => `${s.name}: ${s.value}`).join(', '))
    }

    if (character.skills?.length) {
      parts.push('')
      parts.push('#### Habilidades')
      parts.push(character.skills.map((s) => `${s.name}: ${s.description}`).join(', '))
    }
    parts.push('')
  }

  // --- QUEST ---
  if (quest) {
    parts.push('### MISIÓN Y OBJETIVOS')
    parts.push(`- Título: ${quest.title}`)
    parts.push(`- Descripción: ${quest.description}`)
    if (quest.objectives?.length) {
      parts.push('')
      parts.push('#### Objetivos')
      quest.objectives.forEach((obj, i) => parts.push(`${i + 1}. ${obj.completed ? '✅' : '⬜'} ${obj.name}`))
    }
    parts.push('')
  }

  // --- INVENTORY ---
  if (inventory?.length) {
    parts.push('### INVENTARIO')
    parts.push(inventory.join(', '))
    parts.push('')
  }

  // --- JOURNAL ---
  if (journal?.length) {
    parts.push('### DIARIO DE AVENTURA')
    for (const entry of journal) {
      const date = new Date(entry.timestamp).toLocaleDateString('es-ES')
      parts.push(`- [${date}] ${entry.title}: ${entry.summary} (${entry.eventType})`)
    }
    parts.push('')
  }

  // --- WORLD STATE ---
  parts.push('### MUNDO')
  parts.push(`- Ubicación actual: ${worldState.currentLocation || 'Desconocida'}`)
  parts.push(`- Hora: ${worldState.timeOfDay}${worldState.weather ? ` | Clima: ${worldState.weather}` : ''}`)
  if (worldState.locations.length) {
    parts.push('')
    parts.push('#### Ubicaciones descubiertas')
    for (const loc of worldState.locations) {
      const exits = loc.exits.length ? ` → ${loc.exits.join(', ')}` : ''
      parts.push(`- ${loc.name}: ${loc.description}${exits}`)
    }
  }
  if (worldState.npcs.length) {
    parts.push('')
    parts.push('#### NPCs conocidos')
    for (const npc of worldState.npcs) {
      if (!npc.isAlive) continue
      const rel = npc.relationship >= 0 ? `+${npc.relationship}` : `${npc.relationship}`
      parts.push(`- ${npc.name} (${npc.location}): ${npc.description} — Relación: ${rel}`)
    }
  }
  parts.push('')

  // --- COMBAT ---
  if (combatActive && enemies?.length) {
    parts.push('### COMBATE ACTIVO')
    parts.push(`- Turno: ${combatTurn}`)
    for (const enemy of enemies) {
      if (enemy.isAlive) {
        parts.push(`- ${enemy.name} (HP ${enemy.hp}/${enemy.maxHp}, AC ${enemy.ac})`)
        if (enemy.description) parts.push(`  - ${enemy.description}`)
      }
    }
    parts.push('')
  }

  // --- COMPANIONS ---
  if (companions?.length) {
    parts.push('### COMPAÑEROS')
    for (const comp of companions) {
      if (comp.isActive) {
        const statsStr = comp.stats?.length ? comp.stats.map((s) => `${s.name}: ${s.value}`).join(', ') : ''
        parts.push(`- ${comp.name}: ${comp.description}${statsStr ? ` — ${statsStr}` : ''}`)
      }
    }
    parts.push('')
  }

  const output = parts.join('\n')
  return output ? `\n\n${output}` : ''
}
