const PROXY_TOKEN_KEY = 'rol-proxy-token'

export function getProxyToken(): string {
  try {
    return localStorage.getItem(PROXY_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setProxyToken(token: string): void {
  try {
    if (token.trim()) {
      localStorage.setItem(PROXY_TOKEN_KEY, token.trim())
    } else {
      localStorage.removeItem(PROXY_TOKEN_KEY)
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

export function proxyAuthHeaders(): Record<string, string> {
  const token = getProxyToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
