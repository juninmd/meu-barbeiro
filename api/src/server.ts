import 'dotenv/config'
import { app } from './app.js'
import { bot } from './services/telegram.service.js'
import { startReminderScheduler } from './services/appointment-reminders.service.js'

const PORT = process.env.PORT || 3333

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
  
  if (process.env.TELEGRAM_BOT_TOKEN) {
    bot.launch()
    console.log('Telegram Bot is running')
    if (process.env.REMINDERS_ENABLED === 'true') {
      startReminderScheduler((telegramId, message, options) => bot.telegram.sendMessage(telegramId, message, options))
      console.log('Appointment reminders are running')
    }
  } else {
    console.warn('TELEGRAM_BOT_TOKEN not found, bot will not start')
  }
})
