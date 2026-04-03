import { Router } from 'express'
import { passport } from '../lib/passport'

const router = Router()

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Redireciona para o frontend após o login
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173')
  }
)

router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173')
  })
})

router.get('/me', (req, res) => {
  res.json(req.user || null)
})

export { router as authRoutes }
