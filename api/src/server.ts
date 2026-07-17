import 'dotenv/config'
import { app } from './app.js'
import { bot } from './services/telegram.service.js'

const PORT = process.env.PORT || 3333

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
  
  if (process.env.TELEGRAM_BOT_TOKEN) {
    bot.launch()
    console.log('Telegram Bot is running')
  } else {
    console.warn('TELEGRAM_BOT_TOKEN not found, bot will not start')
  }
})
