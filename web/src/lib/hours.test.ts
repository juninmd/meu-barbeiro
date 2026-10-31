import { describe, expect, it } from 'vitest'
import type { BusinessHour } from '../types'
import { openStatus } from './hours'

const week: BusinessHour[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday, opensAt: '09:00', closesAt: '20:00', breakStartsAt: '12:00', breakEndsAt: '13:00', enabled: weekday >= 2 && weekday <= 6,
}))
const tz = 'America/Sao_Paulo'
// 2026-07-21 é terça-feira; 15:00Z = 12:00 em São Paulo
const at = (iso: string) => new Date(iso)

describe('openStatus', () => {
  it('open during the day', () => expect(openStatus(week, tz, at('2026-07-21T17:00:00Z'))).toEqual({ open: true, label: 'Aberto até 20:00' }))
  it('lunch break', () => expect(openStatus(week, tz, at('2026-07-21T15:30:00Z')).label).toBe('Pausa para o almoço, volta às 13:00'))
  it('before opening', () => expect(openStatus(week, tz, at('2026-07-21T10:00:00Z')).label).toBe('Abre hoje às 09:00'))
  it('after closing points to the next open day', () => expect(openStatus(week, tz, at('2026-07-22T01:00:00Z')).label).toBe('Fechado agora · abre amanhã às 09:00'))
  it('closed day finds the next opening', () => expect(openStatus(week, tz, at('2026-07-19T17:00:00Z')).label).toBe('Fechado agora · abre terça às 09:00'))
  it('uses the shop timezone, not the browser one', () => expect(openStatus(week, 'Asia/Tokyo', at('2026-07-21T17:00:00Z')).open).toBe(false))
})
