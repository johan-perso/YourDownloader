module.exports = (duration) => {
	const regex = /P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?/
	const matches = duration.match(regex)

	if (!matches) return null

	var parsed = {
		years: parseInt(matches[1]) || 0,
		months: parseInt(matches[2]) || 0,
		days: parseInt(matches[3]) || 0,
		hours: parseInt(matches[4]) || 0,
		minutes: parseInt(matches[5]) || 0,
		seconds: parseFloat(matches[6]) || 0
	}
	return (parsed.minutes * 60) + parsed.seconds // return total seconds
}