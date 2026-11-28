import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const storageKey = 'meu-barbeiro:theme'
const darkQuery = '(prefers-color-scheme: dark)'

const read = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** O `<html>` sempre recebe `light` ou `dark`: é a pele que o Sonido e o app leem. */
export const applyTheme = (preference: ThemePreference) => {
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(darkQuery) : null
  const resolved = preference === 'system'
    ? (media?.matches ? 'dark' : 'light')
    : preference
  document.documentElement.setAttribute('data-theme', resolved)
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(read)

  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return
    // "Automático" acompanha a troca do tema do sistema sem recarregar a página.
    const media = window.matchMedia(darkQuery)
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const change = useCallback((next: ThemePreference) => {
    setPreference(next)
    try {
      if (next === 'system') localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, next)
    } catch { /* armazenamento indisponível: vale só nesta sessão */ }
  }, [])

  return [preference, change] as const
}
