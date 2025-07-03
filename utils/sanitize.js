/**
 * Sanitize input to prevent injection in terminal commands
 * @param {string} input - The input string to sanitize
 * @returns {string} - The sanitized string
 */
function sanitizeForTerminal(input) {
	if (typeof input !== "string") throw new Error("Input must be a string")

	return input
		.replace(/\0/g, "") // Remove null bytes
		.replace(/[;&|`$(){}[\]\\<>]/g, "") // Remove or escape shell metacharacters
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control characters except newline and tab
		.trim() // Trim whitespace
}

/**
 * Sanitize a URL for use in terminal commands
 * @param {string} url - The URL to sanitize
 * @returns {string} - The sanitized URL
 */
function sanitizeUrl(url) {
	if (typeof url !== "string") throw new Error("URL must be a string")

	url = url.trim()
	// if (url.includes(";") || url.includes("|") || url.includes("&") || url.includes("`") || url.includes("$")) throw new Error("URL contains potentially dangerous characters") // not needed when using child_process.spawn

	// Basic URL validation
	try {
		const urlObj = new URL(url)

		if (!["http:", "https:"].includes(urlObj.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed")

		// Reconstruct a clean URL to prevent any shell injection
		let cleanUrl = `${urlObj.protocol}//${urlObj.hostname}`
		if (urlObj.port) cleanUrl += `:${urlObj.port}`
		cleanUrl += urlObj.pathname
		if (urlObj.search) cleanUrl += urlObj.search
		if (urlObj.hash) cleanUrl += urlObj.hash

		return cleanUrl
	} catch (error) {
		throw new Error(`Invalid URL: ${error.message}`)
	}
}

/**
 * Sanitize a file path for use in terminal commands
 * @param {string} filePath - The file path to sanitize
 * @returns {string} - The sanitized file path
 */
function sanitizeFilePath(filePath) {
	if (typeof filePath !== "string") throw new Error("File path must be a string")

	const sanitized = filePath
		.replace(/\0/g, "") // Remove null bytes
		.replace(/[;&|`$(){}[\]\\<>]/g, "") // Remove dangerous shell characters
		.replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
		.replace(/\\/g, "/") // Normalize path separators (for cross-platform compatibility)
		.replace(/\/+/g, "/") // Remove multiple consecutive slashes
		.trim() // Trim whitespace

	// Prevent directory traversal attacks
	if (sanitized.includes("../") || sanitized.includes("..\\")) throw new Error("Directory traversal is not allowed")

	return sanitized
}

/**
 * Escape a string for safe use in shell commands
 * @param {string} input - The input string to escape
 * @returns {string} - The escaped string wrapped in single quotes
 */
function escapeShellArg(input) {
	if (typeof input !== "string") throw new Error("Input must be a string")

	// For single quotes, we need to end the quote, add an escaped quote, and start a new quote
	return `'${input.replace(/'/g, "'\"'\"'")}'`
}

/**
 * Validate and sanitize command arguments array
 * @param {Array} args - Array of command arguments
 * @returns {Array} - Array of sanitized arguments
 */
function sanitizeCommandArgs(args) {
	if (!Array.isArray(args)) throw new Error("Arguments must be an array")

	return args.map((arg, index) => {
		if (typeof arg !== "string") {
			throw new Error(`Argument at index ${index} must be a string`)
		}

		// Sanitize each argument
		return sanitizeForTerminal(arg)
	}).filter(arg => arg.length > 0) // Remove empty arguments
}

/**
 * Check if a string contains potentially dangerous patterns
 * @param {string} input - The input string to check
 * @returns {boolean} - True if the string appears safe, false otherwise
 */
function isSafeForTerminal(input) {
	if (typeof input !== "string") return false

	// Check for dangerous patterns
	const dangerousPatterns = [
		/[;&|`$(){}[\]\\<>]/, // Shell metacharacters
		/\0/, // Null bytes
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/, // Control characters
		/\.\.\//, // Directory traversal
		/\.\.\\/, // Directory traversal (Windows)
		/^-/, // Arguments starting with dash (could be confused with flags)
	]

	return !dangerousPatterns.some(pattern => pattern.test(input))
}

/**
 * Sanitize output directory path specifically for yt-dlp
 * @param {string} outputDir - The output directory path
 * @returns {string} - The sanitized output directory path
 */
function sanitizeOutputDir(outputDir) {
	const sanitized = sanitizeFilePath(outputDir)

	// Ensure the path doesn't start with a dash (could be confused with a flag)
	if (sanitized.startsWith("-")) throw new Error("Output directory path cannot start with a dash")

	// Ensure it's a relative path within the project or an absolute path
	if (sanitized.startsWith("/") || sanitized.match(/^[A-Za-z]:/)) {
		return sanitized // Absolute path - validate it's safe
	} else {
		// Relative path - ensure it doesn't go outside current directory
		if (sanitized.startsWith("../")) throw new Error("Output directory cannot be outside the current directory")
		return sanitized
	}
}

module.exports = {
	sanitizeForTerminal,
	sanitizeUrl,
	sanitizeFilePath,
	escapeShellArg,
	sanitizeCommandArgs,
	isSafeForTerminal,
	sanitizeOutputDir
}
