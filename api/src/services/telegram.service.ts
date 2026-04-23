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

  ctx.replyWithHTML(
    `💈 <b>MEU BARBEIRO</b>\n` +
    `──────────────────────\n` +
    `Olá <b>${first_name}</b>! 👋\n\n` +
    `Bem-vindo ao sistema de agendamentos premium.\n\n` +
    `📌 <b>O que você deseja fazer?</b>\n` +
    `• Ver serviços: /servicos\n` +
    `• Agendar agora: /agendar\n` +
    `• Meus agendamentos: /meus_horarios\n\n` +
    `──────────────────────\n` +
    `<i>Sempre pronto para o seu melhor visual!</i>`
  )
})

bot.command('agendar', (ctx) => {
  ctx.replyWithHTML(
    `📅 <b>AGENDAMENTO</b>\n` +
    `──────────────────────\n` +
    `Escolha o serviço desejado:\n\n` +
    `✂️ <b>Cabelo</b> — /cabelo\n` +
    `🧔 <b>Barba</b> — /barba\n` +
    `✨ <b>Sobrancelha</b> — /sobrancelha\n\n` +
    `──────────────────────\n` +
    `<i>Selecione uma opção para continuar.</i>`
  )
})

export { bot }
