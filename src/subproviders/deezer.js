const he = require("he")
const NodeCache = require("node-cache")
const spotifyCache = new NodeCache({ stdTTL: 60 * 60 * 4 }) // Cache to 4 hours

async function getDetails(url) {
	return new Promise(async (resolve, reject) => {
		if(!url || typeof url !== "string") return reject(new Error("Invalid URL provided"))
		if(spotifyCache.has(url)) return resolve(spotifyCache.get(url))

		var webpage = await fetch(url).then(res => {
			if(res.status === 404) return reject(new Error("404: The URL was not found and the server returned a 404 status code"))
			else if(!res.ok) throw new Error(`Server returned status ${res.status} ${res.statusText}`)
			else return res.text()
		}).catch((err) => {
			return reject(new Error(`Failed to check if URL can be accessed: ${url} (${err?.message || err})`))
		})

		if(!webpage || !webpage.trim().length) return reject(new Error("The webpage content is empty or invalid"))

		var details = {
			"title": webpage?.split("<title>")?.[1]?.split("</title>")?.[0]?.split(" - ")?.[1]?.split(" | Deezer")?.[0] || webpage?.split("<meta name=\"og:title\" content=\"")?.[1]?.split("\">")?.[0] || webpage?.split("<meta name=\"twitter:title\" content=\"")?.[1]?.split("\">")?.[0] || "",
			"author": webpage?.split("<meta name=\"twitter:audio:artist_name\" content=\"")?.[1]?.split("\">")?.[0] || webpage?.split("<meta name=\"twitter:creator\" content=\"")?.[1]?.split("\">")?.[0] || webpage?.split("<title>")?.[1]?.split("</title>")?.[0]?.split(" - ")?.[0] || "",
			"duration": parseFloat(webpage?.split("<meta name=\"music:duration\" content=\"")?.[1]?.split("\">")?.[0] || webpage?.split(",\"DURATION\":\"")?.[1]?.split("\",\"")?.[0] || "0"),
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

		details.title = he.decode(details.title) // Deezer returns HTML-escaped characters
		details.author = he.decode(details.author)

		details.find.query.push(`${details.title} - ${details.author}`.trim())
		details.find.query.push(`${details.author} - ${details.title}`.trim())
		details.find.query.push(`${details.author} ${details.title}`.trim())

		var response = { success: true, ...details }
		spotifyCache.set(url, response)
		resolve(response)
	})
}

module.exports = {
	getDetails,
}