import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const storageKey = 'meu-barbeiro:theme'

const read = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** Aplica a preferência no <html>: "system" remove o atributo e o CSS segue prefers-color-scheme. */
export const applyTheme = (preference: ThemePreference) => {
  const root = document.documentElement
  if (preference === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', preference)
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(read)

  useEffect(() => { applyTheme(preference) }, [preference])

  const change = useCallback((next: ThemePreference) => {
    setPreference(next)
    try {
      if (next === 'system') localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, next)
    } catch { /* armazenamento indisponível: vale só nesta sessão */ }
  }, [])

  return [preference, change] as const
}
