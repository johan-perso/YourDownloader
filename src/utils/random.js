const { customAlphabet } = require("nanoid")

module.exports.randomString = function(length = 14) {
	const nanoid = customAlphabet("abcdefghiklnoqrstuvyz123456789", length)
	return nanoid()
}