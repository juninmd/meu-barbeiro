import { Telegraf } from 'telegraf'
import { prisma } from '../lib/prisma'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '')

bot.start(async (ctx) => {
  const { id, first_name } = ctx.from
  
  // Upsert user
  await prisma.user.upsert({
    where: { telegramId: id.toString() },
    update: { name: first_name },
    create: { 
      telegramId: id.toString(),
      name: first_name,
      role: 'CUSTOMER'
    }
  })

  ctx.reply(`Olá ${first_name}! Bem-vindo ao Meu Barbeiro. Como posso te ajudar hoje?`)
})

bot.command('agendar', (ctx) => {
  ctx.reply('Para agendar, escolha um serviço: /cabelo, /barba, /sobrancelha')
})

export { bot }
