const fs = require("fs")
const path = require("path")
const msPrettify = require("ms-prettify").default
const { consola } = require("consola")
const { Telegraf } = require("telegraf")
const { spawn } = require("child_process")
const { randomString } = require("./utils/random")
const { sanitizeUrl } = require("./utils/sanitize")
const convertFile = require("./utils/convertFile")
require("dotenv").config()

const requests = {}

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

	// Check ffmpeg
	await new Promise((resolve) => {
		const child = spawn("ffmpeg", ["-version"])

		var output = ""
		var errorOutput = ""
		child.stdout.on("data", (data) => { output += data.toString() })
		child.stderr.on("data", (data) => { errorOutput += data.toString() })

		child.on("close", (code) => {
			if(code !== 0){
				consola.error(`ffmpeg command failed with code ${code}`)
				if(output.trim()) consola.log(`ffmpeg output: ${output}`)
				if(errorOutput.trim()) consola.log(`ffmpeg error output: ${errorOutput.trim()}`)
				fatal.push("Could not check the version of ffmpeg, this may be caused by ffmpeg not installed at all on the system, or not found in the PATH.")
				return resolve(false)
			}

			if(!output.trim()){
				consola.error("ffmpeg command returned no standard output. Please check if ffmpeg is installed correctly.")
				if(errorOutput.trim()) consola.log(`ffmpeg error output: ${errorOutput.trim()}`)
				fatal.push("ffmpeg is not giving us any informations when getting its version.")
				return resolve(false)
			}

			// ffmpeg version 7.1 Copyright (c) ...
			var version = output.match(/ffmpeg version ([\d.]+)/)?.[1] || output.trim().split(" version ")?.[1]?.split(" ")?.[0]
			if(version.length) version = version.trim()
			if(!version.length){
				consola.error(`ffmpeg command returned unexpected output: "${output.trim()}". Expected to find a version number with string similar to "ffmpeg version 7.1 ...".`)
				if(errorOutput.trim()) consola.log(`ffmpeg error output: ${errorOutput.trim()}`)
				fatal.push("ffmpeg is not giving us a valid version number when getting its version.")
				return resolve(false)
			}

			consola.success(`ffmpeg is installed, version: ${version}`)
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

function escapeHtml(text){
	if(!text) return text
	if(typeof text != "string") return text
	return text?.replace(/&/g, "&amp;")?.replace(/</g, "&lt;")?.replace(/>/g, "&gt;")?.replace(/"/g, "&quot;")?.replace(/'/g, "&#039;")
}
function addSpaceEveryThreeChars(number) {
	if (!number && number !== 0) return number
	if (typeof number !== "number") return number
	return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

function catchErrors(err, ctx){
	consola.error("==============================================================\nAn error was catched: ", err)
	if(ctx){
		const randomCode = `${Math.floor(Math.random() * 1000000) + 100000}${Date.now()}`.toString(64)
		consola.log(`For context, we was checking the message with: msg id = ${ctx?.message?.message_id} ; user id = ${ctx?.message?.from?.id} ; content = ${ctx?.message?.text || "*no text*"}`)
		consola.log(`We will try to tell the user about this error, with the code "${randomCode}"`)

		try {
			ctx.replyWithHTML(`<b>🔴 | An error occured while processing your message</b>\n\nPlease report this problem to the <a href="https://t.me/JohanStick">bot owner</a> with the code <code>${randomCode}</code> so he can access some details.\nYou can also open a new issue on <a href="https://github.com/johan-perso/yourdownloader/issues/new">GitHub</a>.\n\n<pre>${escapeHtml(err?.message || err?.stack || err)}\n</pre>`, { link_preview_options: { is_disabled: true } }).catch(err => consola.error("Couldn't sent the error report to the user: ", err))
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

	var messageContent = ctx.message.text.trim() // properly get the message content

	// Commands
	switch(messageContent.toLowerCase()){
	case "/crashtest":
		return ctx.reply("").catch(err => catchErrors(err, ctx))
	case "/start":
		return ctx.replyWithHTML("<b>YourDownloader 👨‍🍳</b>\n\n<b>1.</b> Send any links here and we will check if we can download it.\n<b>2.</b> Select the file format you need (Video / Audio).\n<b>3.</b> File will be sent here when available.\n\n<i><b>WIP / DO NOT USE RIGHT NOW</b></i>").catch(err => catchErrors(err, ctx))
	case "/donate":
		return ctx.replyWithHTML("<b>YourDownloader 👨‍🍳</b>\n\nYou can support this bot through many ways, here is the list.\n\nBy giving money:\n- <a href='https://paypal.me/moipastoii'>PayPal @moipastoii</a>\n- <a href='https://johanstick.fr/#donate'>Crypto (ETH, SOL, BTC)</a>\n- <a href='https://ko-fi.com/johan_stickman'>Ko-Fi @johan_stickman</a>\n\nWithout paying:\n- <a href='https://github.com/johan-perso/yourdownloader'>Star the GitHub repository</a>\n- <a href='https://github.com/johan-perso'>Follow me on GitHub</a>\n- <a href='https://x.com/Johan_Stickman'>Follow me on Twitter</a>", { link_preview_options: { is_disabled: true } }).catch(err => catchErrors(err, ctx))
	default:
		if(messageContent.startsWith("/")) return ctx.reply("⚠️ | Invalid command. Please use /start to get more details about this bot.").catch(err => catchErrors(err, ctx)) // only slash commands, we will check others messages later
	}

	// If we reach this point, it means that the message is not a command
	if(messageContent.startsWith("http://")) messageContent = messageContent.replace("http://", "https://") // we convert http links to https links
	if(messageContent.startsWith("https://")){
		var url = messageContent.match(/\bhttps?:\/\/\S+/i)?.[0]
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
		var providerName = domainsProviders[domain]
		if(!providerName){
			consola.warn("Using ytdlp provider as a fallback, it may not be supported")
			providerName = "ytdlp"
		}
		const provider = providers[providerName]
		if(!provider) return ctx.replyWithHTML("⚠️ | The provider for this service is not available. Please report this issue to the <a href=\"https://t.me/JohanStick\">bot owner</a>.").catch(err => catchErrors(err, ctx));

		(async () => {
			const ctxReply = await ctx.replyWithHTML("<b>🔍 | Searching details about this link</b>\n\nPlease wait, this may take a few seconds...").catch(err => catchErrors(err, ctx))
			if(!ctxReply){
				consola.error("Failed to send the initial reply to the user, this could have caused issues later on.")
				return
			}

			// Get details about the URL
			consola.info(`Getting details for the URL: ${url} using provider: ${providerName}`)
			var details
			try {
				details = await provider.getDetails(url).catch(err => {
					if(err?.message?.includes("404:")){
						ctx.telegram.editMessageText(ctx.chat.id, ctxReply.message_id, null, "🔴 | It seems we couldn't access the page you entered. You may have typed it wrong, or it is in private mode / region locked.").catch(err => catchErrors(err, ctx))
						return "silentStop"
					}

					catchErrors(err, ctx)
					return null
				})
			} catch (err) {
				catchErrors(err, ctx)
			}

			if(details == "silentStop") return
			if(!details){
				ctx.telegram.editMessageText(ctx.chat.id, ctxReply.message_id, null, "🔴 | An error occured while getting details for this link. Please try again later.").catch(err => catchErrors(err, ctx))
				return
			}

			// Show details to the user, and ask for the format
			// We will handle the download from the inline keyboard events
			const requestId = randomString()
			consola.info(`Request ID generated: ${requestId} for user ${ctx.from.id} with msg id ${ctxReply.message_id} and url ${url}`)
			requests[requestId] = {
				chatId: ctx.chat.id,
				messageId: ctxReply.message_id,
				url: url,
				provider: providerName,
				details: details,
			}
			ctx.telegram.editMessageText(
				ctx.chat.id,
				ctxReply.message_id,
				null,
				`<b>🔍 | Is that what you were looking for?</b>\n\n<b>Title:</b> ${escapeHtml(details?.title)}${details?.author?.length ? `\n<b>Author:</b> ${escapeHtml(details?.author)}` : ""}${details?.duration ? `\n<b>Duration:</b> ${msPrettify(details?.duration * 1000, { max: 2 })}` : ""}${details?.views ? `\n<b>Views:</b> ${addSpaceEveryThreeChars(details?.views)}` : ""}\n\n<i>Select the format you need to start the download, or send another link.</i>`,
				{
					parse_mode: "HTML",
					link_preview_options: { is_disabled: true },
					reply_markup: {
						inline_keyboard: [
							[
								{ text: "🎵 MP3 - Audio", callback_data: `download_mp3_${requestId}` },
								{ text: "🎬 MP4 - Video", callback_data: `download_mp4_${requestId}` }
							]
						]
					}
				}
			).catch(err => catchErrors(err, ctx))
		})().catch(err => catchErrors(err, ctx)) // we use an async function to handle the await inside without blocking the main thread
	}
})

// When a user clicks on an inline keyboard button
bot.action(/download_(mp3|mp4)_(.+)/, async (ctx) => {
	const requestId = ctx.match[2]
	const format = ctx.match[1]
	consola.info(`User ${ctx.from.id} clicked on the download button for request ${requestId} with format ${format}`)

	// Edit the message to delete the inline keyboard
	try {
		await ctx.editMessageReplyMarkup({ inline_keyboard: [] })
	} catch (err) {
		consola.error("Failed to edit the message reply markup, this could cause issues later on.")
		catchErrors(err, ctx)
	}

	// Check if the request exists
	if(!requests[requestId]) return ctx.answerCbQuery("This request is no longer available. Please send a new link to the bot.").catch(err => catchErrors(err, ctx))

	const request = requests[requestId]
	if(request.chatId != ctx.chat.id){
		return ctx.answerCbQuery("❌ | This request was not sent to you.").catch(err => catchErrors(err, ctx))
	}

	// Get the provider and details
	const provider = providers[request.provider]
	if(!provider) return ctx.answerCbQuery("❌ | The provider associated to this video is not available. Please report this issue to the bot owner.").catch(err => catchErrors(err, ctx))

	// Start the download
	var downloadedResponse
	try {
		ctx.telegram.editMessageText(request.chatId, request.messageId, null, "<b>⏳ | We're starting to download your file, it may take a few minutes.</b>\n\nIn the meantime, you can check out how to support us by using the /donate command!", { parse_mode: "HTML" }).catch(err => catchErrors(err, ctx))
		downloadedResponse = await provider.download(request.url, { audioOnly: format === "mp3" })
	} catch (err) {
		catchErrors(err, ctx)
	}

	// If the download failed, we notify the user
	if(downloadedResponse.error || !downloadedResponse.success || !downloadedResponse.filePath){
		consola.error(`Download failed for request ${requestId} with error: ${downloadedResponse.error || "Unknown error"}`)
		return ctx.telegram.editMessageText(request.chatId, request.messageId, null, `<b>🔴 | An error occured while downloading the file.</b>\n\nPlease try again later or report this issue to the <a href="https://t.me/JohanStick">bot owner</a>. You can get more details about this issue here:\n\n<pre>${escapeHtml(downloadedResponse.error || "Unknown error")}</pre>`, { parse_mode: "HTML", link_preview_options: { is_disabled: true } }).catch(err => catchErrors(err, ctx))
	}
	ctx.telegram.editMessageText(request.chatId, request.messageId, null, "<b>⏳ | Finalizing your download...</b>\n\nIn the meantime, you can check out how to support us by using the /donate command!", { parse_mode: "HTML" }).catch(err => catchErrors(err, ctx))

	// If the file isn't in the expected format, we convert it
	if(!downloadedResponse.filePath.endsWith(`.${format}`)){
		consola.info(`File is not in the user-expected format (${format}), we will convert it.`)
		const oldFormat = downloadedResponse.filePath.split(".").pop()

		const convertedResponse = await convertFile(downloadedResponse.filePath, format)
		if(!convertedResponse.success || convertedResponse.error){
			consola.error(`File conversion failed for request ${requestId} with error: ${convertedResponse?.error || "Unknown error"}`)
			return ctx.telegram.editMessageText(request.chatId, request.messageId, null, `<b>🔴 | An error occured while converting the file from ${oldFormat.toUpperCase()} to ${format.toUpperCase()}</b>\n\nPlease try again later or report this issue to the <a href="https://t.me/JohanStick">bot owner</a>. You can get more details about this issue here:\n\n<pre>${escapeHtml(convertedResponse?.error || "Unknown error")?.substring(0, 500)}</pre>`, { parse_mode: "HTML", link_preview_options: { is_disabled: true } }).catch(err => catchErrors(err, ctx))
		}

		downloadedResponse.filePath = convertedResponse.filePath // Update file path to the new one
		consola.success(`File converted successfully from ${oldFormat} to ${format}`)
	}

	// Check file size
	var fileSize = fs.statSync(downloadedResponse.filePath).size
	consola.info(`File size for request ${requestId} is ${(fileSize / (1024 * 1024)).toFixed(2)} MB (${fileSize} bytes)`)
	if(fileSize > 2 * 1024 * 1024 * 1024){ // Telegram has 2 GB limit when using local server
		consola.warn(`File size is too large (${(fileSize / (1024 * 1024)).toFixed(2)} MB), we will notify the user.`)
		return ctx.telegram.editMessageText(request.chatId, request.messageId, null, `<b>🔴 | Your download exceed the Telegram file size limit (${(fileSize / (1024 * 1024)).toFixed(2)} MB / 1.5 GB).</b>\n\nPlease try again with another video or report this issue to the <a href="https://t.me/JohanStick">bot owner</a> if you think this is a mistake.`, { parse_mode: "HTML", link_preview_options: { is_disabled: true } }).catch(err => catchErrors(err, ctx))
	}

	// Send the file to the user
	const details = request?.details || {}
	var fileName = `${details?.title?.length ? details?.title : ""}${details?.title?.length && details?.author?.length ? " - " : ""}${details?.author?.length ? details?.author : ""}`
	if(!fileName.length) fileName = downloadedResponse.filename || `downloaded_file.${format}`
	fileName = fileName.replace(/[^a-zA-Z0-9_\- ]/g, "_").substring(0, 100) // Sanitize the file name and limit it to 100 characters
	consola.info(`Sending the file to the user with file name: ${fileName}`)

	try {
		await ctx.persistentChatAction( // Send a chat action as long as the subsequent action is not completed
			format == "mp4" ? "upload_video" : format == "mp3" ? "upload_voice" : "upload_document",
			async () => {
				// Send the file
				await ctx[format == "mp4" ? "replyWithVideo" : format == "mp3" ? "replyWithAudio" : "replyWithDocument"]({
					source: downloadedResponse.filePath,
					filename: fileName + (format == "mp4" ? ".mp4" : format == "mp3" ? ".mp3" : ""),
				}, {
					title: details?.title || "Your downloaded file",
					performer: details?.author || undefined,
					caption: `<b>📥 | Here is your download!</b>\n\n<b>Title:</b> ${escapeHtml(details?.title)}${details?.author?.length ? `\n<b>Author:</b> ${escapeHtml(details?.author)}` : ""}${details?.duration ? `\n<b>Duration:</b> ${msPrettify(details?.duration * 1000, { max: 2 })}` : ""}${details?.views ? `\n<b>Views:</b> ${addSpaceEveryThreeChars(details?.views)}` : ""}`,
					parse_mode: "HTML",
					link_preview_options: { is_disabled: true }
				})

				// Delete original response
				await ctx.telegram.deleteMessage(request.chatId, request.messageId).catch(err => { consola.warn(`Failed to delete the original message for request ${requestId}:`, err) })
			}
		).catch(err => catchErrors(err, ctx))
	} catch (err) {
		consola.error("Failed to send the file to the user, this could have caused issues later on.")
		catchErrors(err, ctx)
	}

	// Finally, we delete the file from the disk
	consola.info(`Request ${requestId} completed successfully, file sent to user ${ctx.from.id}.`)
	delete requests[requestId]
	try {
		fs.unlinkSync(downloadedResponse.filePath)
		consola.info(`File "${downloadedResponse.filePath}" associated to request ${requestId} deleted from disk.`)
	} catch (err) {
		consola.error(`Failed to delete the file "${downloadedResponse.filePath}" associated to request ${requestId} from disk:`, err)
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