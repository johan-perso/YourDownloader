const NodeCache = require("node-cache")
const songlink = new NodeCache({ stdTTL: 60 * 60 * 4 }) // Cache to 4 hours

async function getDetails(url) {
	return new Promise(async (resolve, reject) => {
		if(!url || typeof url !== "string") return reject(new Error("Invalid URL provided"))
		if(songlink.has(url)) return resolve(songlink.get(url))

		var webpage = await fetch(url).then(res => {
			if(res.status === 404) return reject(new Error("404: The URL was not found and the server returned a 404 status code"))
			else if(!res.ok) throw new Error(`Server returned status ${res.status} ${res.statusText}`)
			else return res.text()
		}).catch((err) => {
			return reject(new Error(`Failed to check if URL can be accessed: ${url} (${err?.message || err})`))
		})

		if(!webpage || !webpage.trim().length) return reject(new Error("The webpage content is empty or invalid"))

		var details = {
			"title": webpage?.split("\"sections\":[{\"title\":\"")?.[1]?.split("\",\"")?.[0] || webpage?.split("<title>")?.[1]?.split("</title>")?.[0]?.split(" by ")?.[0] || "",
			"author": webpage?.split("\",\"artistName\":\"")?.[1]?.split("\",\"")?.[0] || webpage?.split("<title>")?.[1]?.split("</title>")?.[0]?.split(" by ")?.[1] || "",
			"duration": (parseFloat(webpage?.split(",\"duration\":")?.[1]?.split(",\"")?.[0]) || 0) / 1000,
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

		details.find.query.push(`${details.title} - ${details.author}`.trim())
		details.find.query.push(`${details.author} - ${details.title}`.trim())
		details.find.query.push(`${details.author} ${details.title}`.trim())

		var response = { success: true, ...details }
		songlink.set(url, response)
		resolve(response)
	})
}

module.exports = {
	getDetails,
}