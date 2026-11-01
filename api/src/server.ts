import 'dotenv/config'
import { app } from './app.js'
import { bot } from './services/telegram.service.js'
import { ensurePlatformAdmin } from './lib/bootstrap-admin.js'
import { startReminderScheduler } from './services/appointment-reminders.service.js'
import { prisma } from './lib/prisma.js'
import { logger } from './lib/logger.js'

const PORT = Number(process.env.PORT || 3333)

const server = app.listen(PORT, async () => {
  logger.info('server.started', { port: PORT, environment: process.env.NODE_ENV ?? 'development' })

  try {
    const result = await ensurePlatformAdmin()
    if (result !== 'skipped') logger.info('platform.admin-ready', { result })
  } catch (error) {
    logger.error('platform.admin-failed', { error })
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    bot.launch()
      .then(() => logger.info('telegram.started'))
      .catch((error) => logger.error('telegram.failed', { error }))
    if (process.env.REMINDERS_ENABLED === 'true') {
      startReminderScheduler((telegramId, message, options) => bot.telegram.sendMessage(telegramId, message, options))
      logger.info('reminders.started')
    }
  } else {
    logger.warn('telegram.disabled', { message: 'TELEGRAM_BOT_TOKEN ausente' })
  }
})

server.keepAliveTimeout = 65_000
server.headersTimeout = 70_000

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('server.shutdown', { signal })

  const forceExit = setTimeout(() => {
    logger.error('server.shutdown-timeout', { timeoutMs: 10_000 })
    process.exit(1)
  }, 10_000)
  forceExit.unref()

  server.close(async (error) => {
    if (error) logger.error('server.close-failed', { error })
    try {
      bot.stop(signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM')
    } catch {
      // Bot não iniciado: nada a encerrar.
    }
    await prisma.$disconnect().catch((disconnectError) => {
      logger.error('prisma.disconnect-failed', { error: disconnectError })
    })
    logger.info('server.stopped')
    clearTimeout(forceExit)
    process.exit(error ? 1 : 0)
  })
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })
process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled-rejection', { error: reason })
})
process.on('uncaughtException', (error) => {
  logger.error('process.uncaught-exception', { error })
  void shutdown('uncaughtException')
})
