const NodeCache = require("node-cache")
const amazonmusicCache = new NodeCache({ stdTTL: 60 * 60 * 4 }) // Cache to 4 hours

async function getDetails(url) {
	return new Promise(async (resolve, reject) => {
		if(!url || typeof url !== "string") return reject(new Error("Invalid URL provided"))
		if(amazonmusicCache.has(url)) return resolve(amazonmusicCache.get(url))

		if(!url.includes("https://music.amazon.com/tracks/")) return reject(new Error("Invalid Amazon Music URL. It should look like: https://music.amazon.com/tracks/ID"))
		var trackId = url?.split("https://music.amazon.com/tracks/")?.[1]?.split("?")?.[0] || url?.split("https://music.amazon.com/track/")?.[1]
		if(!trackId || !trackId.trim().length) return reject(new Error("Invalid Amazon Music URL because no track ID found. It should look like: https://music.amazon.com/tracks/ID"))

		var deviceId = amazonmusicCache.get("deviceId")
		if(!deviceId) {
			var deviceIdResponse = await fetch("https://music.amazon.com/config.json").then(res => {
				if(!res.ok) return reject(new Error(`${res.status}: Cannot get Amazon Music config.json file`))
				else return res.json()
			}).catch((err) => {
				return reject(new Error(`Failed to fetch Amazon Music config.json: ${err?.message || err}`))
			})
			deviceId = deviceIdResponse?.deviceId
			if(!deviceId) return reject(new Error("Failed to retrieve device ID from Amazon Music config.json"))
			amazonmusicCache.set("deviceId", deviceId, 60 * 60 * 12) // Cache device ID for 12 hours
		}

		var trackResponse = await fetch("https://eu.mesk.skill.music.a2z.com/api/cosmicTrack/displayCatalogTrack", {
			method: "POST",
			body: JSON.stringify({
				"id": trackId,
				"headers": JSON.stringify({
					"x-amzn-authentication": JSON.stringify({
						"interface": "ClientAuthenticationInterface.v1_0.ClientTokenElement",
						"accessToken": ""
					}),
					"x-amzn-device-width": "1920",
					"x-amzn-device-family": "WebPlayer",
					"x-amzn-device-id": deviceId,
					"x-amzn-device-height": "1080",
					"x-amzn-page-url": `https://music.amazon.com/tracks/${trackId}`
				}),
			})
		}).then(res => {
			if(!res.ok) return reject(new Error(`${res.status}: Cannot get track details from Amazon Music`))
			else return res.json()
		}).catch((err) => {
			return reject(new Error(`Failed to check if URL can be accessed: ${url} (${err?.message || err})`))
		})

		var trackResponseError = trackResponse?.methods?.find(method => method?.interface == "Web.TemplatesInterface.v1_0.Touch.ChromeTemplateInterface.ShowNotificationMethod")?.notification?.message?.text
		if(trackResponseError) return resolve({ success: false, error: trackResponseError || "Amazon Music returned an unknown error when getting the track details" })

		var details = {
			"title": trackResponse?.methods?.[0]?.template?.headerText?.text?.replace(" [Explicit]", "") || trackResponse?.methods?.[0]?.template?.headerImageAltText || "",
			"author": trackResponse?.methods?.[0]?.template?.headerPrimaryText || trackResponse?.methods?.[0]?.template?.contextMenu?.options?.[0]?.onItemSelected?.[2]?.template?.headerText?.text || "",
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
		amazonmusicCache.set(url, response)
		resolve(response)
	})
}

module.exports = {
	getDetails,
}