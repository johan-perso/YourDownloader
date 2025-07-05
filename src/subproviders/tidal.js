const parseISO8601Duration = require("../utils/parseISO8601Duration")
const NodeCache = require("node-cache")
const tidalCache = new NodeCache({ stdTTL: 60 * 60 * 4 }) // Cache to 4 hours

async function getDetails(url) {
	return new Promise(async (resolve, reject) => {
		if(!url || typeof url !== "string") return reject(new Error("Invalid URL provided"))
		if(tidalCache.has(url)) return resolve(tidalCache.get(url))

		var webpage = await fetch(url).then(res => {
			if(res.status === 404) return reject(new Error("404: The URL was not found and the server returned a 404 status code"))
			else if(!res.ok) throw new Error(`Server returned status ${res.status} ${res.statusText}`)
			else return res.text()
		}).catch((err) => {
			return reject(new Error(`Failed to check if URL can be accessed: ${url} (${err?.message || err})`))
		})

		if(!webpage || !webpage.trim().length) return reject(new Error("The webpage content is empty or invalid"))

		var details = {
			"title": webpage?.split("\",\"name\":\"")?.[1]?.split("\",\"")?.[0] || webpage?.split("property=\"og:title\" content=\"")?.[1]?.split("\">")?.[0]?.split(" - ")?.[1] || "",
			"author": webpage?.split("property=\"og:title\" content=\"")?.[1]?.split("\">")?.[0]?.split(" - ")?.[0] || "",
			"duration": parseFloat(webpage?.split(",duration:")?.[1]?.split(",")?.[0] || "0"),
			"find": {
				"provider": "ytdlp",
				"platform": "youtube",
				"platformName": "YouTube",
				"query": []
			}
		}

		// Search inside the MusicRecording data context
		try {
			var musicJsonData = webpage?.split("<script type=\"application/json\" id=\"serialized-server-data\">[")[1]?.split("]</script>")[0]
			var parsedData = JSON.parse(musicJsonData)

			details.title = parsedData.name || details.title
			details.author = parsedData?.byArtist?.[0]?.name || details.author
			details.duration = parseISO8601Duration(parsedData.duration) || details.duration
		} catch (err) {}

		if(!details.title.trim().length || !details.author.trim().length) return resolve({
			success: false,
			error: "Unable to find title or artist name on the provided URL"
		})

		details.find.query.push(`${details.title} - ${details.author}`.trim())
		details.find.query.push(`${details.author} - ${details.title}`.trim())
		details.find.query.push(`${details.author} ${details.title}`.trim())

		var response = { success: true, ...details }
		tidalCache.set(url, response)
		resolve(response)
	})
}

module.exports = {
	getDetails,
}