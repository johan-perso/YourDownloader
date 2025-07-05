const { spawn } = require("child_process")
const { consola } = require("consola")
const fs = require("fs")
const path = require("path")

/**
 * Converts a file from one format to another using ffmpeg.
 * The original file is deleted upon successful conversion.
 * @param {string} inputPath - The path to the input file.
 * @param {string} outputFormat - The desired output format (example: "mp4", "mp3").
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>} A promise that resolves with an object containing the success status and either the new file path or an error message.
 */
function convertFile(inputPath, outputFormat) {
	return new Promise((resolve) => {
		const fromAudioToVideo = (path.extname(inputPath) == ".mp3" || path.extname(inputPath) == ".m4a") && outputFormat == "mp4"
		const parsedPath = path.parse(inputPath)
		const outputPath = path.join(parsedPath.dir, `${parsedPath.name}.${outputFormat}`)

		const ffmpegArgs = [
			...(fromAudioToVideo ? ["-f", "lavfi", "-i", "color=black:size=1280x720:rate=1"] : []),
			"-i", inputPath,
			...(fromAudioToVideo ? ["-c:v", "libx264", "-c:a", "aac", "-shortest"] : []),
			"-y", // Overwrite output file if it exists
			outputPath,
		]

		// ffmpeg -f lavfi -i color=black:size=1280x720:rate=1 -i input.mp3 -c:v libx264 -c:a aac -shortest output.mp4

		const ffmpeg = spawn("ffmpeg", ffmpegArgs, { shell: false, timeout: 180000 }) // 3 minutes timeout

		var output = ""
		var errorOutput = ""
		ffmpeg.stdout.on("data", (data) => { output += data.toString() })
		ffmpeg.stderr.on("data", (data) => { errorOutput += data.toString() })

		ffmpeg.on("close", (code) => {
			if(code === 0) {
				// On successful conversion, delete the original file
				fs.unlink(inputPath, (err) => {
					if(err) { // if we can't delete file, we warn in the console but it's not fatal
						consola.warn(`Failed to delete original file "${inputPath}" after conversion:`, err)
					}
				})
				resolve({ success: true, filePath: outputPath })
			} else {
				resolve({ success: false, error: `Conversion failed because ffmpeg exited with code ${code}.\nStdout: ${output}\nStderr: ${errorOutput}` })
			}
		})

		ffmpeg.on("error", (err) => { // This usually means ffmpeg is not installed or not in PATH
			resolve({ success: false, error: `Failed to start ffmpeg process. Error: ${err.message}` })
		})
	})
}

module.exports = convertFile