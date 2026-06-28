import type { ImageConfig } from '../types/game'

export async function generateImage(config: ImageConfig, prompt: string): Promise<string> {
  const body: Record<string, unknown> = {
    model: config.model || 'flux-2-klein',
    prompt,
    n: 1,
    size: config.size || '1024x1024',
    response_format: 'url',
  }

  let res: Response
  if (config.apiKey) {
    res = await fetch(`${config.endpoint}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    })
  } else {
    res = await fetch('/api/proxy/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  if (!res.ok) {
    throw new Error(`Error API de imágenes (${res.status}): ${await res.text().catch(() => '') || res.statusText}`)
  }

  const data = await res.json()
  return data.data?.[0]?.url || ''
}
