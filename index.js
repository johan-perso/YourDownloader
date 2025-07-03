const { consola } = require("consola")
const { Telegraf } = require("telegraf")
require("dotenv").config()

function catchErrors(err, ctx){
	consola.error("==============================================================\nAn error was catched: ", err)
	if(ctx){
		const randomCode = `${Math.floor(Math.random() * 1000000) + 100000}${Date.now()}`.toString(64)
		consola.log(`For context, we was checking the message with: msg id = ${ctx?.message?.message_id} ; user id = ${ctx?.message?.from?.id} ; content = ${ctx?.message?.text || "*no text*"}`)
		consola.log(`We will try to tell the user about this error, with the code "${randomCode}"`)

		try {
			ctx.replyWithHTML(`<b>🔴 | An error occured while processing your message</b>\n\nPlease report this problem to the <a href="https://t.me/JohanStick">bot owner</a> with the code <code>${randomCode}</code> so he can access some details.\nYou can also open a new issue on <a href="https://github.com/johan-perso/yourdownloader/issues/new">GitHub</a>.`, { link_preview_options: { is_disabled: true } }).catch(err => consola.error("Couldn't sent the error report to the user: ", err))
		} catch (err) {
			consola.error("Couldn't sent the error report to the user: ", err)
		}
	}
	consola.error("==============================================================")
}

// Start the bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, { handlerTimeout: 9_000_000 })
bot.launch().then(() => {
	consola.success(`Connected as @${bot.botInfo.username}`) // it seems like, sometimes, this is not triggered even if the bot has launched successfully
})

// When a new message is received
bot.on("message", async (ctx) => {
	consola.info(`Received a new message (${ctx.message.message_id}), user id = ${ctx.message.from.id} ; content = ${ctx.message.text || "*no text*"}`)

	var dateNow = Math.floor(Date.now())
	var dateMsg = Math.floor(ctx.message.date * 1000)
	if(dateMsg < dateNow - 120000) return consola.info(`Ignoring the new message (${ctx.message.message_id}): it was sent a long time ago, msg date = ${new Date(dateMsg).toLocaleTimeString()} (${dateMsg}) ; now: ${new Date(dateNow).toLocaleTimeString()} (${dateNow})`) // we reject messages older than 2 minutes
	if(!ctx.message.text) return consola.info(`Ignoring the new message (${ctx.message.message_id}): it has no text`) // we reject messages without text

	var messageContent = ctx.message.text.toLowerCase().trim() // properly get the message content

	// Commands
	switch(messageContent){
	case "/crashtest":
		return ctx.reply("").catch(err => catchErrors(err, ctx))
	case "/start":
		return ctx.replyWithHTML("<b>YourDownloader 👨‍🍳</b>\n\n<b>1.</b> Send any links here and we will check if we can download it.\n<b>2.</b> Select the file format you need (mp4 or mp3).\n<b>3.</b> File will be sent here when available.\n\n<i><b>WIP / DO NOT USE RIGHT NOW</b></i>").catch(err => catchErrors(err, ctx))
	case "/donate":
		return ctx.replyWithHTML("<b>YourDownloader 👨‍🍳</b>\n\nYou can support this bot through many ways, here is the list.\n\nBy giving money:\n- <a href='https://paypal.me/moipastoii'>PayPal @moipastoii</a>\n- <a href='https://johanstick.fr/#donate'>Crypto (ETH, SOL, BTC)</a>\n- <a href='https://ko-fi.com/johan_stickman'>Ko-Fi @johan_stickman</a>\n\nWithout paying:\n- <a href='https://github.com/johan-perso/yourdownloader'>Star the GitHub repository</a>\n- <a href='https://github.com/johan-perso'>Follow me on GitHub</a>\n- <a href='https://x.com/Johan_Stickman'>Follow me on Twitter</a>", { link_preview_options: { is_disabled: true } }).catch(err => catchErrors(err, ctx))
	default:
		if(messageContent.startsWith("/")) return ctx.reply("⚠️ | Invalid command. Please use /start to get more details about this bot.").catch(err => catchErrors(err, ctx)) // only slash commands, we will check others messages later
	}

	// If we reach this point, it means that the message is not a command
	consola.info(`The message (${ctx.message.message_id}) is not a command, it will be ignored.`)
})

// Allow clean exit
process.on("SIGINT", async () => {
	consola.info("SIGINT detected. Stopping everything...")
	bot.stop()

	consola.info("Exiting process...")
	process.exit()
})
process.on("SIGTERM", async () => {
	consola.info("SIGTERM detected. Stopping everything...")
	bot.stop()

	consola.info("Exiting process...")
	process.exit()
})