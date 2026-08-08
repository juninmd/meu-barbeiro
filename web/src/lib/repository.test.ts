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

  it('builds the appointment calendar from mock state in the barbershop timezone', async () => {
    await repository.createHoliday({ date: '2099-08-04', description: 'Aniversário da cidade' })
    const { appointment } = await repository.createAppointment({
      barberId: 'barber-demo',
      serviceId: 'service-cut',
      scheduledAt: '2099-08-05T13:00:00.000Z',
    })
    await repository.updateAppointment(appointment.id, 'CANCELLED')

    const calendar = await repository.appointmentCalendar('2099-08-02', '2099-08-05')

    expect(calendar).toMatchObject({
      from: '2099-08-02',
      to: '2099-08-05',
      timezone: shopTimezone,
    })
    expect(calendar.days).toHaveLength(4)
    expect(calendar.days[0]).toMatchObject({
      date: '2099-08-02', open: false, reason: 'Fora do expediente', appointments: [],
    })
    expect(calendar.days[2]).toMatchObject({
      date: '2099-08-04', open: false, reason: 'Feriado: Aniversário da cidade', appointments: [],
    })
    expect(calendar.days[3]?.appointments[0]).toMatchObject({
      id: appointment.id,
      time: '10:00',
      status: 'CANCELLED',
      user: { name: 'Marina Costa' },
      barber: { name: 'Rafael Navalha' },
      service: { name: 'Corte assinatura', duration: 45 },
      paymentStatus: 'REFUNDED',
    })
  })

  it('persists tenant branding, hours and Mercado Pago connection', async () => {
    const current = await repository.barbershop()
    await repository.updateBarbershop({
      ...current,
      name: 'Navalha Club',
      primaryColor: '#112233',
      depositType: 'PERCENTAGE',
      depositValue: 30,
      remindersEnabled: false,
      reminderHoursBefore: [2],
      businessHours: current.businessHours.map((hour) => hour.weekday === 2
        ? { ...hour, breakStartsAt: '12:00', breakEndsAt: '13:00' }
        : hour),
    })
    await repository.disconnectMercadoPago()
    expect(await repository.barbershop()).toMatchObject({
      name: 'Navalha Club', primaryColor: '#112233', depositType: 'PERCENTAGE', depositValue: 30,
      remindersEnabled: false, reminderHoursBefore: [2], mercadoPagoConnected: false,
    })
    expect((await repository.barbershop()).businessHours.find((hour) => hour.weekday === 2)).toMatchObject({
      breakStartsAt: '12:00', breakEndsAt: '13:00',
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

  it('creates a confirmed walk-in without online payment in the mock branch', async () => {
    const service = (await repository.services())[0]
    const barber = (await repository.barbers())[0]

    const result = await repository.createWalkIn({
      barberId: barber.id,
      serviceId: service.id,
      scheduledAt: nextOpenDate(13).toISOString(),
      customer: { name: 'Cliente do balcão', phone: '(11) 98888-7777' },
    })

    expect(result.checkoutUrl).toBeNull()
    expect(result.appointment).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'NOT_REQUIRED',
      paymentAmount: 0,
      commission: 0,
      user: { name: 'Cliente do balcão', phone: '11988887777', noShowCount: 0 },
    })
  })

  it('marks a mock appointment NO_SHOW and retains an approved deposit', async () => {
    const updated = await repository.updateAppointment('appointment-1', 'NO_SHOW')

    expect(updated).toMatchObject({ status: 'NO_SHOW', paymentStatus: 'APPROVED', depositRetained: true })
    await expect(repository.updateAppointment('appointment-1', 'CANCELLED'))
      .rejects.toThrow('Este agendamento não permite essa alteração')
    expect((await repository.customers('Marina'))[0]).toMatchObject({ noShowCount: 1 })
  })

  it('prevents deleting a service with active appointments', async () => {
    await expect(repository.deleteService('service-cut')).rejects.toThrow('agendamentos ativos')
  })

  it('creates, lists and removes holidays in date order', async () => {
    const later = await repository.createHoliday({ date: '2099-12-25', description: 'Natal' })
    const sooner = await repository.createHoliday({ date: '2099-01-01', description: 'Ano Novo' })

    expect(await repository.holidays(2099)).toEqual([sooner, later])

    await repository.deleteHoliday(sooner.id)
    expect(await repository.holidays(2099)).toEqual([later])
  })

  it('rejects a duplicate mock holiday date without changing state', async () => {
    await repository.createHoliday({ date: '2099-12-25', description: 'Natal' })

    await expect(repository.createHoliday({ date: '2099-12-25', description: 'Recesso' }))
      .rejects.toThrow('Já existe um feriado cadastrado nesta data')
    expect(await repository.holidays(2099)).toHaveLength(1)
  })

  it('adds stock and persists the new product quantity', async () => {
    const product = (await repository.products())[0]

    await repository.addProductStock(product.id, 4)

    expect((await repository.products()).find((item) => item.id === product.id)?.stockQuantity)
      .toBe(product.stockQuantity + 4)
  })

  it('records a sale at the current price and decrements stock', async () => {
    const product = (await repository.products())[0]

    const sale = await repository.sellProduct(product.id, { quantity: 2 })

    expect(sale).toMatchObject({
      product: { id: product.id, name: product.name },
      quantity: 2,
      unitPrice: product.price,
      total: product.price * 2,
    })
    expect((await repository.products()).find((item) => item.id === product.id)?.stockQuantity)
      .toBe(product.stockQuantity - 2)
    expect(await repository.productSales()).toContainEqual(sale)
  })

  it('rejects an insufficient-stock sale without mutating stock or sales', async () => {
    const product = (await repository.products())[0]
    const salesBefore = await repository.productSales()

    await expect(repository.sellProduct(product.id, { quantity: product.stockQuantity + 1 }))
      .rejects.toThrow(`Estoque insuficiente. Disponível: ${product.stockQuantity}`)

    expect((await repository.products()).find((item) => item.id === product.id)).toEqual(product)
    expect(await repository.productSales()).toEqual(salesBefore)
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

  it('keeps the dated barber list aligned with the slot selector', async () => {
    const availability = await repository.availability('barber-demo', 'service-cut', '2099-08-05')
    const listed = (await repository.barbers('2099-08-05', ['service-cut']))
      .find((barber) => barber.id === 'barber-demo')

    expect(listed).toMatchObject({
      available: availability.slots.length > 0,
      slotCount: availability.slots.length,
      firstAvailableTime: availability.slots[0]?.label,
    })
  })

  it('persists barber schedules and restricts mock availability without expanding the shop', async () => {
    await repository.updateBarberSchedule('barber-demo', [{
      weekday: 3, startsAt: '10:00', endsAt: '22:00', enabled: true,
    }])

    const availability = await repository.availability('barber-demo', 'service-cut', '2099-08-05')

    expect(availability.slots[0]?.label).toBe('10:00')
    expect(availability.slots.at(-1)?.label).toBe('19:15')
    await repository.updateBarberSchedule('barber-demo', [])
    expect(await repository.barberSchedule('barber-demo')).toEqual([])
  })

  it('persists absences, blocks only overlapping slots and exposes the reason in the calendar', async () => {
    const absence = await repository.createBarberAbsence('barber-demo', {
      startsAt: '2099-08-05T13:00:00.000Z',
      endsAt: '2099-08-05T13:45:00.000Z',
      reason: 'Consulta médica',
    })

    const availability = await repository.availability('barber-demo', 'service-cut', '2099-08-05')
    expect(availability.slots.map((slot) => slot.label)).not.toContain('10:00')
    expect(availability.slots.map((slot) => slot.label)).toContain('10:45')
    expect((await repository.appointmentCalendar('2099-08-05', '2099-08-05')).days[0]?.absences[0]).toMatchObject({
      id: absence.id, reason: 'Consulta médica', barberName: 'Rafael Navalha',
    })

    await repository.deleteBarberAbsence('barber-demo', absence.id)
    expect(await repository.barberAbsences('barber-demo')).toEqual([])
  })

  it('converts mock availability from the barbershop timezone to UTC', async () => {
    const availability = await repository.availability('barber-demo', 'service-cut', '2099-08-05')

    expect(availability.slots[0]).toEqual({
      scheduledAt: '2099-08-05T12:00:00.000Z',
      label: '09:00',
    })
  })

  it('removes mock availability slots that overlap lunch', async () => {
    const availability = await repository.availability('barber-demo', 'service-cut', '2099-08-05')
    const labels = availability.slots.map((slot) => slot.label)

    expect(labels).not.toContain('11:30')
    expect(labels).not.toContain('12:00')
    expect(labels).not.toContain('12:45')
    expect(labels).toContain('13:00')
  })

  it('unites any-barber slots and assigns the least-loaded available barber', async () => {
    await repository.createAppointment({
      barberId: 'barber-demo',
      serviceId: 'service-cut',
      scheduledAt: '2099-08-05T12:00:00.000Z',
    })

    const availability = await repository.availability('any', 'service-cut', '2099-08-05')
    expect(availability.slots.find((slot) => slot.label === '09:00')?.barbers?.map((barber) => barber.id))
      .toEqual(['barber-2'])

    const created = await repository.createAppointment({
      barberId: 'any',
      serviceId: 'service-cut',
      scheduledAt: '2099-08-05T13:00:00.000Z',
    })
    expect(created.appointment.barberId).toBe('barber-2')
  })

  it('falls back safely when the last completed service was deactivated', async () => {
    const service = await repository.createService({ name: 'Serviço temporário', duration: 30, price: 40 })
    const created = await repository.createAppointment({
      barberId: 'barber-demo', serviceId: service.id, scheduledAt: '2099-08-05T13:00:00.000Z',
    })
    await repository.updateAppointment(created.appointment.id, 'CONFIRMED')
    await repository.updateAppointment(created.appointment.id, 'DONE')
    await repository.deleteService(service.id)

    await expect(repository.lastAppointment()).resolves.toMatchObject({
      service: { id: service.id, active: false }, repeatable: false,
    })
  })

  it('persists a customer profile in the mock branch with tenant history', async () => {
    const saved = await repository.saveCustomerProfile('customer-demo', {
      preferences: 'Máquina 1 dos lados', notes: 'Não usar água quente', allergies: 'Produto Y',
    })

    expect(saved.profile).toMatchObject({ preferences: 'Máquina 1 dos lados', notes: 'Não usar água quente', allergies: 'Produto Y' })
    await expect(repository.customerProfile('customer-demo')).resolves.toMatchObject({
      profile: { preferences: 'Máquina 1 dos lados' },
      history: { completedAppointments: 0 },
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

  it('creates one mock loyalty stamp only when an appointment becomes DONE', async () => {
    await repository.updateLoyaltyProgram({ enabled: true, requiredVisits: 1, rewardDescription: 'Corte grátis' })
    expect((await repository.loyaltyMe()).availableStamps).toBe(0)

    await repository.updateAppointment('appointment-1', 'DONE')
    const card = await repository.loyaltyMe()
    expect(card.availableStamps).toBe(1)
    expect(card.availableRewards).toBe(1)
    expect(card.stamps).toHaveLength(1)
  })

  it('refuses a mock loyalty redemption without consuming stamps', async () => {
    await repository.updateLoyaltyProgram({ enabled: true, requiredVisits: 2, rewardDescription: 'Corte grátis' })
    await repository.updateAppointment('appointment-1', 'DONE')

    await expect(repository.redeemLoyalty('customer-demo')).rejects.toThrow('selos suficientes')
    expect((await repository.loyaltyMe()).availableStamps).toBe(1)
  })

  it('builds mock closing from DONE services and recorded product sale prices', async () => {
    await repository.updateAppointment('appointment-1', 'DONE')
    await repository.sellProduct('product-pomade', { quantity: 2 })
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: shopTimezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).map((part) => [part.type, part.value]))
    const today = `${parts.year}-${parts.month}-${parts.day}`

    const report = await repository.report(today, today)

    expect(report.cashBasis).toBe('DONE_ONLY')
    expect(report.totals.serviceRevenueCents).toBe(8_500)
    expect(report.totals.productRevenueCents).toBe(6_400)
    expect(report.totals.netRevenueCents).toBe(14_815)
  })
})
