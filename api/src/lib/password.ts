import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64
const COST = 16_384

const derive = (password: string, salt: Buffer, cost: number) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, KEY_LENGTH, { N: cost, maxmem: 64 * 1024 * 1024 }, (error, key) => {
    if (error) reject(error)
    else resolve(key)
  })
})

/** Formato: scrypt$N$salt$hash (base64). O custo vai no hash para permitir subir N no futuro. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, COST)
  return `scrypt$${COST}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const [scheme, cost, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !cost || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(cost))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
