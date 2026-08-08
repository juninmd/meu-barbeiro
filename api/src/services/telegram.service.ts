import { Telegraf } from 'telegraf'
import { prisma } from '../lib/prisma.js'
import { confirmAppointmentFromTelegram } from './appointment-reminders.service.js'

const bot: Telegraf = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '')

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

bot.action(/^confirm:([0-9a-f-]{36})$/, async (ctx) => {
  const appointmentId = ctx.match[1]!
  const result = await confirmAppointmentFromTelegram(appointmentId, ctx.from.id.toString())
  if (result === 'confirmed') {
    await ctx.answerCbQuery('Presença confirmada!')
    await ctx.reply('✅ Presença confirmada. A barbearia já foi avisada!')
    return
  }
  if (result === 'not_found') {
    await ctx.answerCbQuery('Este agendamento não pertence à sua conta.', { show_alert: true })
    return
  }
  await ctx.answerCbQuery('Este agendamento não está mais aguardando confirmação.', { show_alert: true })
})

export { bot }
