import type { Barbershop, EstablishmentRequestStatus, Membership, Role, User } from '@prisma/client'
import { prisma } from './prisma.js'

export interface PublicUser {
  id: string
  name: string
  email: string | null
  username: string | null
  phone: string | null
  telegramId: string | null
  role: Role
  platformAdmin: boolean
  establishmentRequest: EstablishmentRequestStatus
  establishmentRequestNote: string | null
  establishments: Array<{ slug: string; name: string; role: Membership['role'] }>
}

type UserWithMemberships = User & { memberships: Array<Pick<Membership, 'role'> & { barbershop: Pick<Barbershop, 'slug' | 'name'> }> }

export const toPublicUser = (user: UserWithMemberships): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  username: user.username,
  phone: user.phone,
  telegramId: user.telegramId,
  role: user.role,
  platformAdmin: user.platformAdmin,
  establishmentRequest: user.establishmentRequest,
  establishmentRequestNote: user.establishmentRequestNote,
  establishments: user.memberships.map(({ role, barbershop }) => ({ slug: barbershop.slug, name: barbershop.name, role })),
})

export async function loadPublicUser(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { memberships: { select: { role: true, barbershop: { select: { slug: true, name: true } } } } },
  })
  return user ? toPublicUser(user) : null
}
