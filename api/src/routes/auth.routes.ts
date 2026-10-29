import { Router } from 'express'
import { z } from 'zod'
import { googleAuthConfigured, passport } from '../lib/passport.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { loadPublicUser } from '../lib/public-user.js'
import { prisma } from '../lib/prisma.js'
import { rateLimit } from '../lib/rate-limit.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'

const router = Router()

const devLoginEnabled = () => process.env.ENABLE_DEV_LOGIN === 'true' && process.env.NODE_ENV !== 'production'

export const passwordField = z.string().min(8, 'A senha deve ter ao menos 8 caracteres').max(128)

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict()

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: passwordField,
}).strict()

const clientKey = (req: { ip?: string | undefined }) => req.ip ?? 'unknown'
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  key: (req) => `login:${clientKey(req)}:${String(req.body?.identifier ?? '').toLowerCase()}`,
})
const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 10,
  key: (req) => `register:${clientKey(req)}`,
  message: 'Muitos cadastros deste dispositivo. Tente novamente mais tarde.',
})

// Hash fixo para igualar o tempo de resposta quando o usuário não existe.
const dummyHash = 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64')

router.get('/providers', (_req, res) => {
  res.json({ password: true, google: googleAuthConfigured || devLoginEnabled() })
})

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body)
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: { equals: identifier, mode: 'insensitive' } }, { username: { equals: identifier, mode: 'insensitive' } }] },
    })
    const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash)
    if (!user || !user.passwordHash || !valid) {
      res.status(401).json({ message: 'Usuário ou senha incorretos' })
      return
    }
    req.login(user, async (error) => {
      if (error) return next(error)
      try {
        res.json(await loadPublicUser(user.id))
      } catch (caught) {
        next(caught)
      }
    })
  } catch (error) {
    next(error)
  }
})

router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body)
    const existing = await prisma.user.findFirst({ where: { email: { equals: input.email, mode: 'insensitive' } } })
    if (existing) {
      res.status(409).json({ message: 'Já existe uma conta com este e-mail. Entre ou recupere o acesso.' })
      return
    }
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password), role: 'CUSTOMER' },
    })
    req.login(user, async (error) => {
      if (error) return next(error)
      try {
        res.status(201).json(await loadPublicUser(user.id))
      } catch (caught) {
        next(caught)
      }
    })
  } catch (error) {
    next(error)
  }
})

router.post('/password', requireUser, loginLimiter, async (req, res, next) => {
  try {
    const input = z.object({ currentPassword: z.string().max(128).optional(), newPassword: passwordField }).strict().parse(req.body)
    const user = req.user as SessionUser
    if (user.passwordHash && !(await verifyPassword(input.currentPassword ?? '', user.passwordHash))) {
      res.status(400).json({ message: 'Senha atual incorreta' })
      return
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

router.get('/google', (req, res, next) => {
  if (!googleAuthConfigured) {
    if (devLoginEnabled()) {
      res.redirect(`${process.env.API_PUBLIC_URL || 'http://localhost:3333'}/dev/google`)
      return
    }
    res.status(503).json({ message: 'Login com Google não configurado' })
    return
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
})

router.get('/google/callback',
  (req, res, next) => {
    if (!googleAuthConfigured) {
      res.status(503).json({ message: 'Login com Google não configurado' })
      return
    }
    passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}?login=failed` })(req, res, next)
  },
  (req, res) => {
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173')
  }
)

router.post('/logout', (req, res, next) => {
  req.logout(() => {
    req.session.destroy((error) => {
      if (error) return next(error)
      res.clearCookie('connect.sid')
      res.status(204).end()
    })
  })
})

router.get('/me', async (req, res, next) => {
  try {
    const user = req.user as SessionUser | undefined
    res.json(user ? await loadPublicUser(user.id) : null)
  } catch (error) {
    next(error)
  }
})

export { router as authRoutes }
