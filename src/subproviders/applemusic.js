const NodeCache = require("node-cache")
const applemusicCache = new NodeCache({ stdTTL: 60 * 60 * 4 }) // Cache to 4 hours

async function getDetails(url) {
	return new Promise(async (resolve, reject) => {
		if(!url || typeof url !== "string") return reject(new Error("Invalid URL provided"))
		if(applemusicCache.has(url)) return resolve(applemusicCache.get(url))

		var webpage = await fetch(url).then(res => {
			if(res.status === 404) return reject(new Error("404: The URL was not found and the server returned a 404 status code"))
			else if(!res.ok) throw new Error(`Server returned status ${res.status} ${res.statusText}`)
			else return res.text()
		}).catch((err) => {
			return reject(new Error(`Failed to check if URL can be accessed: ${url} (${err?.message || err})`))
		})

		if(!webpage || !webpage.trim().length) return reject(new Error("The webpage content is empty or invalid"))

		var details = {
			"title": webpage?.split("<meta name=\"apple:title\" content=\"")[1]?.split("\">")[0] || webpage?.split("\"@type\":\"MusicComposition\",\"name\":\"")[1]?.split("\",\"")[0] || "",
			"author": webpage?.split("\"byArtist\":[{\"@type\":\"MusicGroup\",\"name\":\"")[1]?.split("\",\"")[0] || "",
			"duration": parseFloat(webpage?.replace(/\n/g, "")?.replace(/\t/g, "")?.replace(/ /g, "")?.split("\"tertiaryLinks\":null,\"duration\":")[1]?.split(",\"")[0] || webpage?.split(",\"duration\":\"")[1]?.split(",\"")[0] || "0") / 1000,
			"find": {
				"provider": "ytdlp",
				"platform": "youtube",
				"platformName": "YouTube",
				"query": []
			}
		}
		if(!details.title.trim().length || !details.author.trim().length) return resolve({
			success: false,
			error: "Unable to find title or artist name on the provided URL"
		})

		// Search inside the serialized server data for the track duration (as the method may fail if getting details about an album)
		try {
			var serializedServerData = webpage?.split("<script type=\"application/json\" id=\"serialized-server-data\">[")[1]?.split("]</script>")[0]
			var parsedData = JSON.parse(serializedServerData)
			console.log(parsedData)

			var track = {}
			if(parsedData) track = parsedData?.data?.sections?.find(section => section?.id?.includes("track-list"))?.items?.find(track => track?.title == details?.title)
			console.log(track)
			details.duration = (track?.duration / 1000) || details?.duration
		} catch (err) {}

		details.find.query.push(`${details.title} - ${details.author}`.trim())
		details.find.query.push(`${details.author} - ${details.title}`.trim())
		details.find.query.push(`${details.author} ${details.title}`.trim())

		var response = { success: true, ...details }
		applemusicCache.set(url, response)
		resolve(response)
	})
}

module.exports = {
	getDetails,
}