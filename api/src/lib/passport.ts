import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { prisma } from './prisma'

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await prisma.user.upsert({
        where: { googleId: profile.id },
        update: { name: profile.displayName, email: profile.emails?.[0].value },
        create: {
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0].value,
          role: 'CUSTOMER'
        }
      })
      return done(null, user)
    } catch (error) {
      return done(error as Error, undefined)
    }
  }
))

passport.serializeUser((user: any, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id: string, done) => {
  const user = await prisma.user.findUnique({ where: { id } })
  done(null, user)
})

export { passport }
