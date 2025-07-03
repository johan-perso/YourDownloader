const { consola } = require("consola")
const { Telegraf } = require("telegraf")
const { spawn } = require("child_process")
const { sanitizeUrl } = require("./utils/sanitize")
require("dotenv").config()

const providers = {
	"ytdlp": require("./providers/ytdlp"),
}

const domainsProviders = {
	"youtube.com": "ytdlp",
	"youtu.be": "ytdlp",
}

async function globalCheck(){
	consola.info("Starting global checks...")
	var fatal = []

	// Check yt-dlp
	await new Promise((resolve) => {
		const child = spawn("yt-dlp", ["--version"])

		var output = ""
		var errorOutput = ""
		child.stdout.on("data", (data) => { output += data.toString() })
		child.stderr.on("data", (data) => { errorOutput += data.toString() })

		child.on("close", (code) => {
			if(code !== 0){
				consola.error(`yt-dlp command failed with code ${code}`)
				if(output.trim()) consola.log(`yt-dlp output: ${output}`)
				if(errorOutput.trim()) consola.log(`yt-dlp error output: ${errorOutput.trim()}`)
				fatal.push("Could not check the version of yt-dlp, this may be caused by yt-dlp not installed at all on the system, or not found in the PATH.")
				return resolve(false)
			}

			if(!output.trim()){
				consola.error("yt-dlp command returned no standard output. Please check if yt-dlp is installed correctly.")
				if(errorOutput.trim()) consola.log(`yt-dlp error output: ${errorOutput.trim()}`)
				fatal.push("yt-dlp is not giving us any informations when getting its version.")
				return resolve(false)
			}

			if(!output.trim().match(/^\d+\.\d+\.\d+/)){
				consola.error(`yt-dlp command returned unexpected output: "${output.trim()}". Expected a version number like "2025.06.30".`)
				if(errorOutput.trim()) consola.log(`yt-dlp error output: ${errorOutput.trim()}`)
				fatal.push("yt-dlp is not giving us a valid version number when getting its version.")
				return resolve(false)
			}

			if(output.split(".")[0] != new Date().getFullYear()) consola.warn(`yt-dlp version is from the year ${output.split(".")[0]}, but the current year is ${new Date().getFullYear()}. You should consider updating yt-dlp if possible.`)

			consola.success(`yt-dlp is installed, version: ${output.trim()}`)
			resolve(true)
		})

		child.on("error", () => {
		})
	})

	// Check Fetch API
	if(!global.fetch){
		consola.error("Fetch API is not available. This will cause issues with some providers. Please ensure you are using a recent NodeJS version (v22 or higher is recommended).")
		fatal.push(process.versions.node > 21 ? "You need to update the version of NodeJS you are using to at least v22, as the Fetch API is not available in older versions." : "It seems your NodeJS version is recent enough, but we still recommend you to update if possible.")
	}

	if(fatal.length){
		consola.error(`Fatal errors were found during global checks:\n${fatal.map(err => `- ${err}`).join("\n")}`)
		return process.exit(1)
	}

	consola.success("Global checks completed successfully.")
}

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

// Main function (includes starting the bot)
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, { handlerTimeout: 9_000_000 })
async function main(){
	await globalCheck()

	consola.info("Starting the bot...")
	bot.launch().then(() => {
		consola.success(`Connected as @${bot.botInfo.username}`) // it seems like, sometimes, this is not triggered even if the bot has launched successfully
	})
}
main()

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
	if(messageContent.startsWith("http://")) messageContent = messageContent.replace("http://", "https://") // we convert http links to https links
	if(messageContent.startsWith("https://")){
		const url = messageContent.match(/\bhttps?:\/\/\S+/i)?.[0]
		consola.info(`Received a link: ${url}`)

		// Check if the link is valid
		try { sanitizeUrl(url) } catch (err) {
			return ctx.replyWithHTML("⚠️ | Invalid URL. To download something, you should send a valid link starting with <code>https://</code>.").catch(err => catchErrors(err, ctx))
		}

		// Get the domain of the URL
		var domain = new URL(url).hostname.replace(/^www\./, "")
		consola.info(`Domain extracted from the URL: ${domain}`)
		if(domain == "youtu.be"){ // convert youtu.be links to youtube.com links
			domain = "youtube.com"
			url = url.replace("youtu.be/", "youtube.com/watch?v=")
		}

		// Check if the domain is supported and get the provider associated
		const providerName = domainsProviders[domain]
		if(!providerName) return ctx.replyWithHTML("⚠️ | Unsupported service. Use /start to get a better understanding of this bot.").catch(err => catchErrors(err, ctx))
		const provider = providers[providerName]
		if(!provider) return ctx.replyWithHTML("⚠️ | The provider for this service is not available. Please report this issue to the bot owner.").catch(err => catchErrors(err, ctx))
	}
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