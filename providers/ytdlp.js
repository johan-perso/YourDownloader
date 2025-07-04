const { spawn } = require("child_process")
const { consola } = require("consola")
const fs = require("fs")
const path = require("path")
const { randomString } = require("../utils/random")
const { sanitizeUrl, sanitizeOutputDir, sanitizeForTerminal } = require("../utils/sanitize")

const NodeCache = require("node-cache")
const ytdlpCache = new NodeCache({ stdTTL: 60 * 60 * 4 }) // Cache to 4 hours

function cleanYtbUrl(url = "") {
	if (!url) return ""
	const urlObj = new URL(url)
	if (urlObj.search) {
		const searchParams = new URLSearchParams(urlObj.search)
		searchParams.delete("list") // Remove playlist parameter
		searchParams.delete("start_radio") // Remove start radio parameter
		urlObj.search = searchParams.toString()
	}
	return urlObj.toString()
}

/**
 * Download options for yt-dlp
 * @typedef {Object} DownloadOptions
 * @property {string} format - Output format (`mp4`, `mp3`, `best`, etc.)
 * @property {string} quality - Video quality (e.g., `720p`, `1080p`, `best`) (default: `best`)
 * @property {string} outputDir - Directory used to save the downloaded file (default: `./temp`)
 * @property {string} filename - Template for the output filename (default: `RANDOMSTRING.%(ext)s`)
 * @property {boolean} audioOnly - If true, download only the audio in mp3 format (default: `false`)
 * @property {number} maxFileSize - Maximum file size in MB (default: `5000` MB = 5 GB)
 */

/**
 * Download result
 * @typedef {Object} DownloadResult
 * @property {boolean} success - Indicates if the download was successful
 * @property {string} [error] - Error message if the download failed
 * @property {string} [filePath] - Path to the downloaded file, if successful
 * @property {string} [filename] - Name of the downloaded file, if successful
 */

/**
 * Fetch details about a YouTube video without downloading it
 * @param {string} url - URL of the YouTube video
 * @returns {Promise<Object>}
 */
async function getDetails(url) {
	return new Promise(async (resolve, reject) => {
		if(!url || typeof url !== "string") return reject(new Error("Invalid URL provided"))
		if (ytdlpCache.has(url)) return resolve(ytdlpCache.get(url))

		// Sanitize the URL before using it
		var sanitizedUrl
		try {
			sanitizedUrl = sanitizeUrl(cleanYtbUrl(url))
		} catch (error) {
			return reject(new Error(`URL sanitization failed: ${error?.message || error}`))
		}
		if(!sanitizedUrl) return reject(new Error("Invalid or empty URL provided"))

		var webpage = await fetch(sanitizedUrl).then(res => {
			if (!res.ok) throw new Error(`Server returned status ${res.status} ${res.statusText}`)
			return res.text()
		}).catch((err) => {
			return reject(new Error(`Failed to check if URL can be accessed: ${sanitizedUrl} (${err?.message || err})`))
		})

		// If the webpage is not accessible, reject
		if (!webpage || webpage.includes("404 Not Found") || webpage.includes("This video is unavailable") || webpage.includes("<title> - YouTube</title>")) return reject(new Error(`404: The URL is not accessible or the video could not be found: ${sanitizedUrl}`))

		const fallbackTitle = webpage.match(/<title>(.*?)<\/title>/)?.[1]?.trim() || "Unknown Title"

		const args = [
			"--dump-json",
			"--no-download",
			"--no-playlist",
			sanitizedUrl
		]

		const ytdlp = spawn("yt-dlp", args, { shell: false, timeout: 15000 }) // 15 seconds timeout
		let output = ""
		let errorOutput = ""

		ytdlp.stdout.on("data", (data) => { output += data.toString() })
		ytdlp.stderr.on("data", (data) => { errorOutput += data.toString() })

		ytdlp.on("close", (code) => {
			if(code != 0) return reject(new Error(`Failed to execute yt-dlp command:\nCode: ${code}\nStdout: ${output}\nStderr: ${errorOutput}`))

			try {
				const info = JSON.parse(output)
				const parsedInfo = {
					title: info?.title || fallbackTitle,
					author: info?.uploader,
					duration: info?.duration,
					creationDate: info?.upload_date,
					views: info?.view_count,
					likes: info?.like_count,
					// formats: info?.formats?.map(f => ({
					// 	format_id: f.format_id,
					// 	ext: f.ext,
					// 	quality: f.quality,
					// 	filesize: f.filesize
					// })) || []
				}
				ytdlpCache.set(url, parsedInfo)
				resolve(parsedInfo)
			} catch (error) {
				reject(new Error(`Failed to parse metadata: ${error?.message || error}`))
			}
		})
	})
}

/**
 * Download a YouTube video
 * @param {string} url - URL of the YouTube video
 * @param {DownloadOptions} options - Download options
 * @returns {Promise<DownloadResult>}
 */
async function download(url, options = {}) {
	const defaultOptions = {
		format: "best", // do not use it when calling the function
		quality: "best", // do not use it when calling the function
		outputDir: "./temp", // do not use it when calling the function
		filename: `${randomString()}.%(ext)s`, // Random filename with extension
		audioOnly: false,
		maxFileSize: 5000 // = 5 GB
	}
	const opts = { ...defaultOptions, ...options }

	return new Promise(async (resolve) => {
		try {
			// Sanitize options
			const sanitizedUrl = sanitizeUrl(cleanYtbUrl(url))
			const sanitizedOutputDir = sanitizeOutputDir(opts.outputDir)
			const sanitizedFormat = sanitizeForTerminal(opts.format)
			const sanitizedQuality = sanitizeForTerminal(opts.quality)

			// Create output directory if it doesn't exist
			if(!fs.existsSync(sanitizedOutputDir)) fs.mkdirSync(sanitizedOutputDir, { recursive: true })

			consola.info(`ytdlp: Starting downloading: ${sanitizedUrl}`)
			const args = []

			// File format
			if (opts.audioOnly || sanitizedFormat === "mp3") {
				args.push("-x", "--audio-format", "mp3")
			} else if (sanitizedFormat === "mp4") {
				args.push("-f", "best[ext=mp4]/best")
			} else {
				args.push("-f", sanitizedFormat)
			}

			// File quality
			if (sanitizedQuality !== "best" && !opts.audioOnly) args.push("-f", `best[height<=${sanitizedQuality.replace("p", "")}]`)

			// Max file size
			if (opts.maxFileSize) args.push("--max-filesize", `${opts.maxFileSize}m`)

			// Name and output path
			const outputTemplate = path.join(sanitizedOutputDir, opts.filename)
			args.push("-o", outputTemplate)

			// Additional options
			args.push(
				"--no-playlist", // Avoid downloading playlists
				"--embed-thumbnail", // Attach thumbnail to file
				"--add-metadata", // Keep metadata
				sanitizedUrl
			)

			consola.info(`ytdlp: will execute "yt-dlp ${args.join(" ")}"`)

			const ytdlp = spawn("yt-dlp", args, {
				stdio: ["pipe", "pipe", "pipe"],
				shell: false, // Help prevent injection
				timeout: 600000 // 10 minutes timeout
			})
			let errorOutput = ""
			let downloadedFilePath = ""

			ytdlp.stdout.on("data", (data) => {
				const output = data.toString()
				consola.info(`yt-dlp: ${output.trim()}`)
			})

			ytdlp.stderr.on("data", (data) => { errorOutput += data.toString() })

			ytdlp.on("close", async (code) => {
				if (code === 0) {
					try {
						// Search for the downloaded file
						if (!downloadedFilePath) {
							const files = fs.readdirSync(sanitizedOutputDir)
								.filter(f => f.endsWith(".mp4") || f.endsWith(".mp3") || f.endsWith(".webm"))
								.map(f => ({
									name: f,
									path: path.join(sanitizedOutputDir, f),
									stats: fs.statSync(path.join(sanitizedOutputDir, f))
								}))
								.sort((a, b) => b.stats.mtime - a.stats.mtime)

							if (files.length > 0) downloadedFilePath = files[0].path
						}

						if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
							consola.success(`ytdlp: Finished downloading: ${downloadedFilePath}`)
							resolve({
								success: true,
								filePath: downloadedFilePath,
								filename: path.basename(downloadedFilePath)
							})
						} else {
							resolve({
								success: false,
								error: "Unable to find the downloaded file"
							})
						}
					} catch (error) {
						resolve({
							success: false,
							error: `Post download error: ${error?.message || error}`
						})
					}
				} else {
					consola.error(`ytdlp: Command failed with code ${code}`)
					consola.error(`ytdlp: ${errorOutput}`)

					resolve({
						success: false,
						error: `Failed to download (code ${code}): ${errorOutput}`
					})
				}
			})

		} catch (error) {
			resolve({
				success: false,
				error: `Sanitization failed or unexpected error: ${error?.message || error}`
			})
		}
	})
}

module.exports = {
	getDetails,
	download,
}