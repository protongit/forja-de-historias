export function extractField(text: string, field: string): string | null {
  // Anclado a inicio de línea para no capturar el nombre del campo dentro de la prosa
  const patterns = [
    new RegExp(`(?:^|\\n)\\s*\\*\\*${field}:?\\*\\*\\s*([^\\n]+)`, 'i'),
    new RegExp(`(?:^|\\n)\\s*\\*${field}:?\\*\\s*([^\\n]+)`, 'i'),
    new RegExp(`(?:^|\\n)\\s*${field}:?\\s*([^\\n]+)`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

export function extractList(text: string, field: string): string[] {
  const patterns = [
    new RegExp(`(?:^|\\n)\\s*\\*\\*${field}:?\\*\\*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i'),
    new RegExp(`(?:^|\\n)\\s*${field}:?([\\s\\S]*?)(?=\\n\\w+:|$)`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1]
        .split('\n')
        .flatMap((l) => l.replace(/^[-*]\s*/, '').split(','))
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return []
}
