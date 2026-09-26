export function extractField(text: string, field: string): string | null {
  const patterns = [
    new RegExp(`\\*\\*${field}:?\\*\\*\\s*([^\\n]+)`, 'i'),
    new RegExp(`\\*${field}:?\\*\\s*([^\\n]+)`, 'i'),
    new RegExp(`${field}:?\\s*([^\\n]+)`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

export function extractList(text: string, field: string): string[] {
  const patterns = [
    new RegExp(`\\*\\*${field}:?\\*\\*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i'),
    new RegExp(`${field}:?([\\s\\S]*?)(?=\\n\\w+:|$)`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1]
        .split('\n')
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
    }
  }
  return []
}
