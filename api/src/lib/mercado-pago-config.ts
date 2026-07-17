import type { Barbershop } from '@prisma/client'
import { MercadoPagoClient } from '../integrations/mercado-pago.js'
import { prisma } from './prisma.js'
import { SecretBox } from './secrets.js'

const required = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} não configurado`)
  return value
}

export const mercadoPagoClient = () => new MercadoPagoClient({
  accessToken: required('MERCADO_PAGO_ACCESS_TOKEN'),
  clientId: required('MERCADO_PAGO_CLIENT_ID'),
  clientSecret: required('MERCADO_PAGO_CLIENT_SECRET'),
})

const secretBox = () => new SecretBox(required('TOKEN_ENCRYPTION_KEY'))

export async function sellerAccessToken(barbershop: Barbershop): Promise<string> {
  if (!barbershop.mercadoPagoAccessTokenEncrypted || !barbershop.mercadoPagoRefreshTokenEncrypted) {
    throw new Error('Mercado Pago não conectado para esta barbearia')
  }
  const box = secretBox()
  const current = box.decrypt(barbershop.mercadoPagoAccessTokenEncrypted)
  if (barbershop.mercadoPagoTokenExpiresAt && barbershop.mercadoPagoTokenExpiresAt.getTime() > Date.now() + 86_400_000) {
    return current
  }

  const refreshed = await mercadoPagoClient().refreshSellerAuthorization(
    box.decrypt(barbershop.mercadoPagoRefreshTokenEncrypted),
  )
  await prisma.barbershop.update({
    where: { id: barbershop.id },
    data: {
      mercadoPagoSellerId: refreshed.sellerId,
      mercadoPagoAccessTokenEncrypted: box.encrypt(refreshed.accessToken),
      mercadoPagoRefreshTokenEncrypted: box.encrypt(refreshed.refreshToken),
      mercadoPagoTokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
    },
  })
  return refreshed.accessToken
}

export const encryptSellerToken = (value: string) => secretBox().encrypt(value)
