import { hashPassword } from './password.js'
import { prisma } from './prisma.js'

const MIN_PRODUCTION_PASSWORD = 12

/**
 * Garante a conta do administrador da plataforma a partir do ambiente.
 * Em produção a senha é obrigatória e precisa ter ao menos 12 caracteres: sem ela nenhuma conta é criada.
 * Fora de produção, sem ADMIN_PASSWORD, nada é criado (o seed local define admin/admin).
 */
export async function ensurePlatformAdmin(env: NodeJS.ProcessEnv = process.env): Promise<'created' | 'updated' | 'skipped'> {
  const password = env.ADMIN_PASSWORD
  const username = (env.ADMIN_USERNAME || 'admin').trim().toLowerCase()
  const production = env.NODE_ENV === 'production'

  if (!password || (production && password.length < MIN_PRODUCTION_PASSWORD)) {
    const reason = !password
      ? 'ADMIN_PASSWORD não definido'
      : `ADMIN_PASSWORD deve ter ao menos ${MIN_PRODUCTION_PASSWORD} caracteres em produção`
    if (!production) return 'skipped'
    // Sem nenhum administrador a plataforma não consegue liberar estabelecimentos: falha cedo, com mensagem clara.
    if (await prisma.user.count({ where: { platformAdmin: true } }) === 0) {
      throw new Error(`${reason}: defina o Secret antes do primeiro deploy (nenhum administrador existe)`)
    }
    console.error(`${reason}: administrador existente mantido`)
    return 'skipped'
  }

  const email = env.ADMIN_EMAIL?.trim().toLowerCase() || null
  const passwordHash = await hashPassword(password)
  const existing = await prisma.user.findUnique({ where: { username } })
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash, platformAdmin: true, role: 'ADMIN', ...(email ? { email } : {}) },
    create: { username, name: 'Administrador', email, passwordHash, platformAdmin: true, role: 'ADMIN' },
  })
  return existing ? 'updated' : 'created'
}
