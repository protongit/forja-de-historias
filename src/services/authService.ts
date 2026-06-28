export interface User {
  username: string
  passwordHash: string
  createdAt: number
}

const USERS_KEY = 'rol-users'
const CURRENT_USER_KEY = 'rol-current-user'

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return 'djb2_' + Math.abs(hash).toString(36)
}

async function oldHashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getUsers(): Record<string, User> {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveUsers(users: Record<string, User>): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getCurrentUser(): string | null {
  return localStorage.getItem(CURRENT_USER_KEY)
}

export function setCurrentUser(username: string | null): void {
  if (username) {
    localStorage.setItem(CURRENT_USER_KEY, username)
  } else {
    localStorage.removeItem(CURRENT_USER_KEY)
  }
}

export async function register(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = username.trim().toLowerCase()
  if (!trimmed || trimmed.length < 2) {
    return { ok: false, error: 'El nombre de usuario debe tener al menos 2 caracteres' }
  }
  if (!/^[a-z0-9_]+$/.test(trimmed)) {
    return { ok: false, error: 'Solo letras minúsculas, números y guión bajo' }
  }
  if (password.length < 4) {
    return { ok: false, error: 'La clave debe tener al menos 4 caracteres' }
  }

  const users = getUsers()
  if (users[trimmed]) {
    return { ok: false, error: 'El usuario ya existe' }
  }

  const passwordHash = simpleHash(password)
  users[trimmed] = { username: trimmed, passwordHash, createdAt: Date.now() }
  saveUsers(users)
  setCurrentUser(trimmed)
  return { ok: true }
}

export async function login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = username.trim().toLowerCase()
  const users = getUsers()
  const user = users[trimmed]
  if (!user) {
    return { ok: false, error: 'Usuario o clave incorrectos' }
  }

  const passwordHash = simpleHash(password)
  const oldHash = crypto.subtle ? await oldHashPassword(password) : null

  if (user.passwordHash !== passwordHash && user.passwordHash !== oldHash) {
    return { ok: false, error: 'Usuario o clave incorrectos' }
  }

  if (user.passwordHash !== passwordHash) {
    user.passwordHash = passwordHash
    saveUsers(users)
  }

  setCurrentUser(trimmed)
  return { ok: true }
}

export function logout(): void {
  setCurrentUser(null)
}

export function deleteAccount(username: string): void {
  const users = getUsers()
  delete users[username]
  saveUsers(users)
  const prefix = `rol-${username}-`
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k))
  setCurrentUser(null)
}

export function listUsers(): string[] {
  return Object.keys(getUsers())
}

export function userDataKey(username: string, suffix: string): string {
  return `rol-${username}-${suffix}`
}