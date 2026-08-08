import { Prisma } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()
const memberRoles = requireBarbershopRole('OWNER', 'ADMIN', 'BARBER')
const managerRoles = requireBarbershopRole('OWNER', 'ADMIN')
const idSchema = z.string().uuid()

router.use(requireUser, resolveBarbershop)

router.get('/', memberRoles, async (req, res) => {
  const products = await prisma.product.findMany({
    where: { barbershopId: req.barbershop!.id },
    orderBy: { name: 'asc' },
  })
  res.json(products.map(publicProduct))
})

router.get('/sales', managerRoles, async (req, res) => {
  const query = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(req.query)
  const { from, to } = salesRange(query, req.barbershop!.timezone)
  if (from && to && from >= to) {
    res.status(400).json({ message: 'Intervalo de vendas inválido' })
    return
  }

  const sales = await prisma.productSale.findMany({
    where: {
      barbershopId: req.barbershop!.id,
      createdAt: { ...(from && { gte: from }), ...(to && { lt: to }) },
    },
    include: {
      product: { select: { id: true, name: true } },
      soldBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(sales.map(publicSale))
})

router.post('/', managerRoles, async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(3).max(80),
    price: z.number().positive().max(10_000),
    stockQuantity: z.number().int().min(0),
  }).strict().parse(req.body)

  try {
    const product = await prisma.product.create({
      data: {
        barbershopId: req.barbershop!.id,
        name: input.name,
        priceCents: Math.round(input.price * 100),
        stockQuantity: input.stockQuantity,
      },
    })
    res.status(201).json(publicProduct(product))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'Já existe um produto com esse nome' })
      return
    }
    throw error
  }
})

router.patch('/:id', managerRoles, async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const input = z.object({
    name: z.string().trim().min(3).max(80).optional(),
    price: z.number().positive().max(10_000).optional(),
    active: z.boolean().optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, { message: 'Informe ao menos um campo' }).parse(req.body)

  try {
    const product = await prisma.product.update({
      where: { barbershopId_id: { barbershopId: req.barbershop!.id, id } },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.price !== undefined && { priceCents: Math.round(input.price * 100) }),
        ...(input.active !== undefined && { active: input.active }),
      },
    })
    res.json(publicProduct(product))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'Já existe um produto com esse nome' })
      return
    }
    throw error
  }
})

router.post('/:id/stock', managerRoles, async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const input = z.object({ quantity: z.number().int().positive() }).strict().parse(req.body)
  const product = await prisma.product.update({
    where: { barbershopId_id: { barbershopId: req.barbershop!.id, id } },
    data: { stockQuantity: { increment: input.quantity } },
  })
  res.json(publicProduct(product))
})

router.delete('/:id', managerRoles, async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const sales = await prisma.productSale.count({
    where: { barbershopId: req.barbershop!.id, productId: id },
  })
  if (sales > 0) {
    res.status(409).json({ message: 'Produto possui vendas registradas. Desative-o para preservar o histórico.' })
    return
  }
  try {
    await prisma.product.delete({
      where: { barbershopId_id: { barbershopId: req.barbershop!.id, id } },
    })
    res.status(204).end()
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      res.status(409).json({ message: 'Produto possui vendas registradas. Desative-o para preservar o histórico.' })
      return
    }
    throw error
  }
})

router.post('/:id/sales', memberRoles, async (req, res) => {
  const id = idSchema.parse(req.params.id)
  const input = z.object({
    quantity: z.number().int().positive(),
    appointmentId: z.string().uuid().optional(),
  }).strict().parse(req.body)
  const user = req.user as SessionUser
  const barbershopId = req.barbershop!.id

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { barbershopId_id: { barbershopId, id } },
    })
    if (!product) return { kind: 'not-found' } as const
    if (!product.active) return { kind: 'inactive' } as const

    if (input.appointmentId) {
      const appointment = await tx.appointment.findFirst({
        where: { id: input.appointmentId, barbershopId },
        select: { id: true },
      })
      if (!appointment) return { kind: 'invalid-appointment' } as const
    }

    const updated = await tx.product.updateMany({
      where: { id, barbershopId, active: true, stockQuantity: { gte: input.quantity } },
      data: { stockQuantity: { decrement: input.quantity } },
    })
    if (updated.count === 0) {
      const current = await tx.product.findUnique({
        where: { barbershopId_id: { barbershopId, id } },
        select: { active: true, stockQuantity: true },
      })
      if (!current) return { kind: 'not-found' } as const
      if (!current.active) return { kind: 'inactive' } as const
      return { kind: 'insufficient-stock', available: current.stockQuantity } as const
    }

    const sale = await tx.productSale.create({
      data: {
        barbershopId,
        productId: id,
        quantity: input.quantity,
        unitPriceCents: product.priceCents,
        soldById: user.id,
        ...(input.appointmentId && { appointmentId: input.appointmentId }),
      },
      include: {
        product: { select: { id: true, name: true } },
        soldBy: { select: { id: true, name: true } },
      },
    })
    return { kind: 'sale', sale } as const
  })

  if (result.kind === 'not-found') {
    res.status(404).json({ message: 'Produto não encontrado' })
    return
  }
  if (result.kind === 'inactive') {
    res.status(409).json({ message: 'Produto inativo não pode ser vendido' })
    return
  }
  if (result.kind === 'invalid-appointment') {
    res.status(400).json({ message: 'Agendamento não pertence a esta barbearia' })
    return
  }
  if (result.kind === 'insufficient-stock') {
    res.status(409).json({ message: `Estoque insuficiente. Disponível: ${result.available}` })
    return
  }
  res.status(201).json(publicSale(result.sale))
})

const publicProduct = (product: { id: string; name: string; priceCents: number; stockQuantity: number; active: boolean }) => ({
  id: product.id,
  name: product.name,
  price: product.priceCents / 100,
  stockQuantity: product.stockQuantity,
  active: product.active,
})

const publicSale = (sale: {
  id: string
  quantity: number
  unitPriceCents: number
  appointmentId: string | null
  createdAt: Date
  product: { id: string; name: string }
  soldBy: { id: string; name: string }
}) => ({
  id: sale.id,
  product: sale.product,
  quantity: sale.quantity,
  unitPrice: sale.unitPriceCents / 100,
  total: sale.quantity * sale.unitPriceCents / 100,
  soldBy: sale.soldBy,
  appointmentId: sale.appointmentId ?? null,
  createdAt: sale.createdAt,
})

const salesRange = ({ from, to }: { from?: string | undefined; to?: string | undefined }, timezone: string) => {
  if (!from && !to) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    return { from: localMidnight(today, timezone), to: localMidnight(nextDate(today), timezone) }
  }
  return {
    from: from ? parseBoundary(from, timezone, false) : undefined,
    to: to ? parseBoundary(to, timezone, true) : undefined,
  }
}

const parseBoundary = (value: string, timezone: string, end: boolean) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return localMidnight(end ? nextDate(value) : value, timezone)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new z.ZodError([])
  return parsed
}

const nextDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10)
}

const localMidnight = (date: string, timezone: string) => {
  const [year, month, day] = date.split('-').map(Number)
  const target = Date.UTC(year!, month! - 1, day!)
  let timestamp = target
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]))
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
    timestamp += target - represented
  }
  return new Date(timestamp)
}

export { router as productsRoutes }
