// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mockEnabled, repository } from './repository'

describe('development mock repository', () => {
  beforeEach(() => localStorage.clear())

  // O expediente é validado no fuso da barbearia, não no de quem roda o teste.
  // Usar setHours/getDay locais faz o teste passar só em máquinas em UTC-3 e
  // falhar no CI, que roda em UTC.
  const shopTimezone = 'America/Sao_Paulo'

  const shopParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: shopTimezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    return Object.fromEntries(parts.map((part) => [part.type, part.value]))
  }

  // Instante UTC que corresponde a `hour`:00 no fuso da barbearia naquele dia.
  const shopTimeToInstant = (date: Date, hour: number) => {
    const { year, month, day } = shopParts(date)
    const guess = Date.UTC(Number(year), Number(month) - 1, Number(day), hour, 0, 0, 0)
    let timestamp = guess
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const local = shopParts(new Date(timestamp))
      const represented = Date.UTC(
        Number(local.year),
        Number(local.month) - 1,
        Number(local.day),
        Number(local.hour),
        Number(local.minute),
      )
      timestamp += guess - represented
    }
    return new Date(timestamp)
  }

  const nextOpenDate = (hour = 11) => {
    const closedWeekdays = ['Sun', 'Mon']
    let date = new Date(Date.now() + 24 * 60 * 60 * 1000)
    while (closedWeekdays.includes(String(shopParts(date).weekday))) {
      date = new Date(date.getTime() + 24 * 60 * 60 * 1000)
    }
    return shopTimeToInstant(date, hour)
  }

  it('is enabled only under the development test environment', () => {
    expect(mockEnabled).toBe(true)
  })

  it('uses R$ 20 monthly and 1% commission defaults', async () => {
    const barbershop = await repository.barbershop()
    expect(barbershop.monthlyFeeCents).toBe(2_000)
    expect(barbershop.commissionBps).toBe(100)
    expect(barbershop.membershipRole).toBe('OWNER')
  })

  it('persists tenant branding, hours and Mercado Pago connection', async () => {
    const current = await repository.barbershop()
    await repository.updateBarbershop({
      ...current,
      name: 'Navalha Club',
      primaryColor: '#112233',
      depositType: 'PERCENTAGE',
      depositValue: 30,
    })
    await repository.disconnectMercadoPago()
    expect(await repository.barbershop()).toMatchObject({
      name: 'Navalha Club', primaryColor: '#112233', depositType: 'PERCENTAGE', depositValue: 30, mercadoPagoConnected: false,
    })
    await repository.connectMercadoPago()
    expect((await repository.barbershop()).mercadoPagoConnected).toBe(true)
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
    expect(created.appointment.paymentStatus).toBe('APPROVED')
    expect(created.appointment.commission).toBe(0.55)
    await repository.updateAppointment(created.appointment.id, 'CONFIRMED')

    const barberAppointments = await repository.appointments(repository.mockUser('BARBER'))
    expect(barberAppointments.find((item) => item.id === created.appointment.id)?.status).toBe('CONFIRMED')
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
    })).rejects.toThrow('A barbearia não atende neste dia')
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
    expect(stored.filter((item) => item.scheduledAt === input.scheduledAt)).toEqual([first.appointment])
  })

  it('returns no availability on a closed day', async () => {
    await expect(repository.availability('barber-demo', 'service-cut', '2099-08-02')).resolves.toEqual({
      date: '2099-08-02',
      timezone: 'America/Sao_Paulo',
      open: false,
      reason: 'A barbearia não atende neste dia',
      slots: [],
    })
  })

  it('removes availability slots that conflict with an appointment', async () => {
    await repository.createAppointment({
      barberId: 'barber-demo',
      serviceId: 'service-cut',
      scheduledAt: '2099-08-05T13:00:00.000Z',
    })

    const availability = await repository.availability('barber-demo', 'service-cut', '2099-08-05')

    expect(availability.slots.map((slot) => slot.label)).not.toContain('10:00')
  })

  it('converts mock availability from the barbershop timezone to UTC', async () => {
    const availability = await repository.availability('barber-demo', 'service-cut', '2099-08-05')

    expect(availability.slots[0]).toEqual({
      scheduledAt: '2099-08-05T12:00:00.000Z',
      label: '09:00',
    })
  })

  it('reschedules without conflicting with itself or changing payment data', async () => {
    const input = {
      barberId: 'barber-demo',
      serviceId: 'service-cut',
      scheduledAt: nextOpenDate(13).toISOString(),
    }
    const { appointment } = await repository.createAppointment(input)

    const updated = await repository.rescheduleAppointment(appointment.id, appointment.scheduledAt)

    expect(updated).toMatchObject({
      scheduledAt: appointment.scheduledAt,
      barberId: appointment.barberId,
      serviceId: appointment.serviceId,
      paymentStatus: appointment.paymentStatus,
      paymentExpiresAt: appointment.paymentExpiresAt,
      paymentAmount: appointment.paymentAmount,
      commission: appointment.commission,
    })
  })

  it('rejects rescheduling outside business hours without changing the appointment', async () => {
    const before = (await repository.appointments(repository.mockUser('CUSTOMER')))[0]
    const sunday = nextOpenDate()
    while (sunday.getDay() !== 0) sunday.setDate(sunday.getDate() + 1)

    await expect(repository.rescheduleAppointment(before.id, sunday.toISOString()))
      .rejects.toThrow('A barbearia não atende neste dia')
    expect((await repository.appointments(repository.mockUser('CUSTOMER')))[0]).toEqual(before)
  })

  it('rejects rescheduling a terminal appointment', async () => {
    await repository.updateAppointment('appointment-1', 'DONE')

    await expect(repository.rescheduleAppointment('appointment-1', nextOpenDate(13).toISOString()))
      .rejects.toThrow('Este agendamento não pode ser remarcado')
  })

  it('rejects changes to a terminal appointment and preserves its status', async () => {
    await repository.updateAppointment('appointment-1', 'DONE')
    await expect(repository.updateAppointment('appointment-1', 'CANCELLED'))
      .rejects.toThrow('Este agendamento não permite essa alteração')
    const stored = await repository.appointments(repository.mockUser('CUSTOMER'))
    expect(stored.find((item) => item.id === 'appointment-1')?.status).toBe('DONE')
  })
})
