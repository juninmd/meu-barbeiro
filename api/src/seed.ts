import { PrismaClient } from '@prisma/client'
import { SecretBox } from './lib/secrets.js'

const prisma = new PrismaClient()
const box = new SecretBox(process.env.TOKEN_ENCRYPTION_KEY!)

const staff = [
  { email: 'rafael@demo.local', name: 'Rafael Navalha', membership: 'OWNER' as const },
  { email: 'caio@demo.local', name: 'Caio Santos', membership: 'BARBER' as const },
]

const customers = [
  { email: 'marina@demo.local', name: 'Marina Costa' },
  { email: 'pedro@demo.local', name: 'Pedro Lima' },
  { email: 'lucas@demo.local', name: 'Lucas Rocha' },
]

const services = [
  { name: 'Corte assinatura', duration: 45, priceCents: 5_500 },
  { name: 'Barba terapêutica', duration: 30, priceCents: 3_800 },
  { name: 'Corte + barba', duration: 75, priceCents: 8_500 },
]

async function main() {
  const barbershop = await prisma.barbershop.upsert({
    where: { slug: 'barbearia-central' },
    update: {
      subscriptionStatus: 'ACTIVE',
      mercadoPagoSellerId: process.env.MOCK_SELLER_ID || '123456789',
      mercadoPagoAccessTokenEncrypted: box.encrypt('mock-seller-access-token'),
      mercadoPagoRefreshTokenEncrypted: box.encrypt('mock-seller-refresh-token'),
      mercadoPagoTokenExpiresAt: new Date(Date.now() + 180 * 86_400_000),
    },
    create: {
      slug: 'barbearia-central',
      name: 'Barbearia Central',
      address: 'Rua das Navalhas, 27 · Centro',
      primaryColor: '#d99b32',
      depositType: 'FULL',
      depositValue: 0,
      subscriptionStatus: 'ACTIVE',
      mercadoPagoSellerId: process.env.MOCK_SELLER_ID || '123456789',
      mercadoPagoAccessTokenEncrypted: box.encrypt('mock-seller-access-token'),
      mercadoPagoRefreshTokenEncrypted: box.encrypt('mock-seller-refresh-token'),
      mercadoPagoTokenExpiresAt: new Date(Date.now() + 180 * 86_400_000),
    },
  })

  for (let weekday = 0; weekday < 7; weekday += 1) {
    const enabled = weekday >= 1 && weekday <= 6
    await prisma.businessHour.upsert({
      where: { barbershopId_weekday: { barbershopId: barbershop.id, weekday } },
      update: { opensAt: '09:00', closesAt: '20:00', enabled },
      create: { barbershopId: barbershop.id, weekday, opensAt: '09:00', closesAt: '20:00', enabled },
    })
  }

  for (const person of staff) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: { name: person.name, role: 'BARBER' },
      create: { email: person.email, name: person.name, role: 'BARBER' },
    })
    await prisma.membership.upsert({
      where: { barbershopId_userId: { barbershopId: barbershop.id, userId: user.id } },
      update: { role: person.membership },
      create: { barbershopId: barbershop.id, userId: user.id, role: person.membership },
    })
  }

  for (const person of customers) {
    await prisma.user.upsert({
      where: { email: person.email },
      update: { name: person.name, role: 'CUSTOMER' },
      create: { email: person.email, name: person.name, role: 'CUSTOMER' },
    })
  }

  for (const service of services) {
    await prisma.service.upsert({
      where: { barbershopId_name: { barbershopId: barbershop.id, name: service.name } },
      update: { duration: service.duration, priceCents: service.priceCents },
      create: { barbershopId: barbershop.id, ...service },
    })
  }

  console.log(`[seed] barbearia ${barbershop.slug} pronta com ${staff.length + customers.length} usuários`)
}

main()
  .catch((error) => {
    console.error('[seed] falhou', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
