const { GetListByKeyword } = require("youtube-search-api")

const NodeCache = require("node-cache")
const youtubeSearchCache = new NodeCache({ stdTTL: 60 * 60 * 4 }) // Cache to 4 hours

async function search(query, maxResults = 1) {
	return new Promise(async (resolve, reject) => {
		if(!query || typeof query !== "string") return reject(new Error("Invalid query provided"))
		if(youtubeSearchCache.has(query)) return resolve(youtubeSearchCache.get(query))

		var results = await GetListByKeyword(query, false, maxResults + 5).catch((err) => {
			return reject(new Error(`Failed to search for the query: ${query} (${err?.message || err})`))
		})

		if(results.items.length) results.items = results.items.filter(item => item.id && item.type == "video" && !item.type.isLive)
		if(results.items.length) results.items = results.items.slice(0, maxResults)

		if (!results || !results.items || results.items.length === 0) {
			return resolve({
				success: false,
				error: "No results found for this query"
			})
		}

		var response = { success: true, url: `https://youtube.com/watch?v=${results.items[0].id}` }
		youtubeSearchCache.set(query, response)
		resolve(response)
	})
}

module.exports = {
	search
}