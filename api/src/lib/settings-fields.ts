import { z } from 'zod'

const isValidTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const isHttpsLogo = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
  } catch {
    return false
  }
}

export const timezoneField = z.string().trim().min(3).max(80).refine(
  isValidTimeZone,
  'Fuso horário inválido (use o formato Continente/Cidade, ex.: America/Sao_Paulo)',
)

export const logoUrlField = z.union([
  z.string().max(500).refine(isHttpsLogo, 'O logotipo precisa ser uma URL https'),
  z.literal(''),
  z.null(),
])
