import type { ImageConfig } from '../types/game'
import { proxyAuthHeaders } from './proxyToken'

const IMAGE_TIMEOUT_MS = 90_000

export async function generateImage(config: ImageConfig, prompt: string): Promise<string> {
  const body: Record<string, unknown> = {
    model: config.model || 'flux-2-klein',
    prompt,
    n: 1,
    size: config.size || '1024x1024',
    response_format: 'url',
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS)

  try {
    let res: Response
    if (config.apiKey) {
      res = await fetch(`${config.endpoint}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } else {
      res = await fetch('/api/proxy/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...proxyAuthHeaders() },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    }

    if (!res.ok) {
      throw new Error(`Error del proveedor de imágenes (${res.status})`)
    }

    const data = await res.json()
    const item = data?.data?.[0]
    if (item?.url) return item.url
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
    throw new Error('El proveedor de imágenes no devolvió ninguna imagen')
  } finally {
    clearTimeout(timeout)
  }
}
