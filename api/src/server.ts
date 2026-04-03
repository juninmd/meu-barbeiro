import { app } from './app'
import { bot } from './services/telegram.service'

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
