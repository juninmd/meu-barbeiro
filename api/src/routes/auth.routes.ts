import { Router } from 'express'
import { googleAuthConfigured, passport } from '../lib/passport.js'

const router = Router()

router.get('/google', (req, res, next) => {
  if (!googleAuthConfigured) {
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
    // Redireciona para o frontend após o login
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

router.get('/me', (req, res) => {
  res.json(req.user || null)
})

export { router as authRoutes }
