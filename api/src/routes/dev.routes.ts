import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()
const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173'
const apiUrl = () => process.env.API_PUBLIC_URL || 'http://localhost:3333'

const roleLabel: Record<string, string> = { ADMIN: 'Administrador', BARBER: 'Barbeiro', CUSTOMER: 'Cliente' }

// Simula a tela de escolha de conta do Google enquanto o OAuth real não está configurado.
router.get('/google', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] })
  const accounts = users.filter((user) => user.email).map((user) => `
    <a class="account" href="${apiUrl()}/dev/login?email=${encodeURIComponent(user.email!)}">
      <span class="avatar">${user.name.slice(0, 1)}</span>
      <span class="who"><strong>${user.name}</strong><small>${user.email} · ${roleLabel[user.role] ?? user.role}</small></span>
    </a>`).join('')

  res.type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Escolha uma conta</title><style>
*{box-sizing:border-box}body{font-family:Roboto,system-ui,sans-serif;background:#f1f3f4;margin:0;display:grid;place-items:center;min-height:100vh;padding:24px}
.card{background:#fff;border:1px solid #dadce0;border-radius:8px;max-width:420px;width:100%;padding:40px}
h1{font-size:22px;font-weight:400;margin:16px 0 6px;color:#202124}p{color:#5f6368;font-size:14px;margin:0 0 24px}
.account{display:flex;gap:14px;align-items:center;padding:12px 8px;border-radius:8px;text-decoration:none;color:#202124;border-top:1px solid #e8eaed}
.account:hover{background:#f8f9fa}
.avatar{width:36px;height:36px;border-radius:50%;background:#1a73e8;color:#fff;display:grid;place-items:center;font-weight:600}
.who{display:flex;flex-direction:column}.who small{color:#5f6368;font-size:12px}
.note{margin-top:24px;font-size:12px;color:#5f6368;border-top:1px solid #e8eaed;padding-top:16px}
</style></head><body><main class="card">
<h1>Escolha uma conta</h1><p>para continuar em <strong>Meu Barbeiro</strong></p>
${accounts}
<p class="note">Login simulado do ambiente local. Nenhuma conta Google real é usada.</p>
</main></body></html>`)
})

// Rotas de homologação local. Habilitadas apenas com ENABLE_DEV_LOGIN=true.
router.get('/login', async (req, res, next) => {
  try {
    const { email, redirect } = z.object({
      email: z.string().email(),
      redirect: z.string().optional(),
    }).parse(req.query)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(404).json({ message: `Usuário de demonstração ${email} não existe` })
      return
    }
    req.login(user, (error) => {
      if (error) return next(error)
      res.redirect(redirect || frontendUrl())
    })
  } catch (error) {
    next(error)
  }
})

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, memberships: { select: { role: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(users)
})

export { router as devRoutes }
