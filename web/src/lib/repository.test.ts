// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mockEnabled, repository } from './repository'

describe('development mock repository', () => {
  beforeEach(() => localStorage.clear())

  const nextOpenDate = (hour = 11) => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
    while ([0, 1].includes(date.getDay())) date.setDate(date.getDate() + 1)
    date.setHours(hour, 0, 0, 0)
    return date
  }

  it('is enabled only under the development test environment', () => {
    expect(mockEnabled).toBe(true)
  })

  it('isolates appointments by customer and barber role', async () => {
    const customer = repository.mockUser('CUSTOMER')
    const barber = repository.mockUser('BARBER')

    const customerAppointments = await repository.appointments(customer)
    const barberAppointments = await repository.appointments(barber)

    expect(customerAppointments).toHaveLength(1)
    expect(customerAppointments.every((item) => item.userId === customer.id)).toBe(true)
    expect(barberAppointments).toHaveLength(3)
    expect(barberAppointments.every((item) => item.barberId === barber.id)).toBe(true)
  })

  it('persists a customer appointment and lets the barber update it', async () => {
    const service = (await repository.services())[0]
    const barber = (await repository.barbers())[0]
    const scheduledAt = nextOpenDate().toISOString()

    const created = await repository.createAppointment({
      barberId: barber.id,
      serviceId: service.id,
      scheduledAt,
    })
    await repository.updateAppointment(created.id, 'CONFIRMED')

    const barberAppointments = await repository.appointments(repository.mockUser('BARBER'))
    expect(barberAppointments.find((item) => item.id === created.id)?.status).toBe('CONFIRMED')
  })

  it('prevents deleting a service with active appointments', async () => {
    await expect(repository.deleteService('service-cut')).rejects.toThrow('agendamentos ativos')
  })

  it('rejects past appointments without mutating state', async () => {
    const before = await repository.appointments(repository.mockUser('CUSTOMER'))
    await expect(repository.createAppointment({
      barberId: 'barber-demo',
      serviceId: 'service-cut',
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
    })).rejects.toThrow('Horário deve estar no futuro')
    expect(await repository.appointments(repository.mockUser('CUSTOMER'))).toEqual(before)
  })

  it('rejects malformed appointment dates without mutating state', async () => {
    const before = await repository.appointments(repository.mockUser('CUSTOMER'))
    await expect(repository.createAppointment({
      barberId: 'barber-demo',
      serviceId: 'service-cut',
      scheduledAt: 'not-a-date',
    })).rejects.toThrow('Horário inválido')
    expect(await repository.appointments(repository.mockUser('CUSTOMER'))).toEqual(before)
  })

  it('rejects a closed day without mutating state', async () => {
    const sunday = nextOpenDate()
    while (sunday.getDay() !== 0) sunday.setDate(sunday.getDate() + 1)
    const before = await repository.appointments(repository.mockUser('CUSTOMER'))
    await expect(repository.createAppointment({
      barberId: 'barber-demo',
      serviceId: 'service-cut',
      scheduledAt: sunday.toISOString(),
    })).rejects.toThrow('Escolha de terça a sábado, entre 09:00 e 20:00')
    expect(await repository.appointments(repository.mockUser('CUSTOMER'))).toEqual(before)
  })

  it('rejects overlapping appointments and preserves the first booking', async () => {
    const input = {
      barberId: 'barber-demo',
      serviceId: 'service-cut',
      scheduledAt: nextOpenDate(13).toISOString(),
    }
    const first = await repository.createAppointment(input)
    await expect(repository.createAppointment(input)).rejects.toThrow('Este horário acabou de ser reservado')
    const stored = await repository.appointments(repository.mockUser('CUSTOMER'))
    expect(stored.filter((item) => item.scheduledAt === input.scheduledAt)).toEqual([first])
  })

  it('rejects changes to a terminal appointment and preserves its status', async () => {
    await repository.updateAppointment('appointment-1', 'DONE')
    await expect(repository.updateAppointment('appointment-1', 'CANCELLED'))
      .rejects.toThrow('Este agendamento não permite essa alteração')
    const stored = await repository.appointments(repository.mockUser('CUSTOMER'))
    expect(stored.find((item) => item.id === 'appointment-1')?.status).toBe('DONE')
  })
})
