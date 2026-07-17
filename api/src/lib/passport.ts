import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import type { User } from '@prisma/client'
import { prisma } from './prisma.js'

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
export const googleAuthConfigured = Boolean(googleClientId && googleClientSecret)

if (googleClientId && googleClientSecret) {
  passport.use(new GoogleStrategy({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: "/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value ?? null
        const user = await prisma.user.upsert({
          where: { googleId: profile.id },
          update: { name: profile.displayName, email },
          create: {
            googleId: profile.id,
            name: profile.displayName,
            email,
            role: 'CUSTOMER'
          }
        })
        return done(null, user)
      } catch (error) {
        return done(error as Error, undefined)
      }
    }
  ))
} else {
  console.warn('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — skipping GoogleStrategy')
}

passport.serializeUser((user, done) => {
  done(null, (user as User).id)
})

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } })
    done(null, user ?? false)
  } catch (error) {
    done(error)
  }
})

export { passport }
