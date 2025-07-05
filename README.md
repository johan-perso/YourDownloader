###### Version française [ici](https://github.com/johan-perso/yourdownloader/blob/main/README.fr.md).

# YourDownloader

A Telegram bot allowing you to download videos and audios files from supported platforms *"providers"*, with the ability to search for them directly from others supported platforms *"subproviders"*. Selfhostable for more privacy, open-source and free without ads!

This project uses the [Telegraf](https://telegraf.js.org/) library to interact with Telegram Bot API, and uses [ffmpeg](https://ffmpeg.org/) + [yt-dlp](https://github.com/yt-dlp/yt-dlp) to download and convert files.

## Hosting with Docker

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with [Docker Compose](https://docs.docker.com/compose/install/)
- A Telegram bot token (create your by sending a message to [@BotFather](https://t.me/botfather))
- Telegram API ID and API Hash (obtained from [my.telegram.org](https://my.telegram.org/apps))
	- You don't have to enter any website if asked, and you can select Desktop as the used platform.

### Installation

1. Clone the repository:
```bash
git clone https://github.com/johan-perso/yourdownloader.git
cd yourdownloader
```

2. Configure environment variables
```bash
cp .env.example .env
# Edit the .env file with the values you obtained from BotFather and my.telegram.org
```

3. Build and run the Docker container:
```bash
docker-compose up -d --build
```

### Access the bot

You can now send the `/start` command to your bot based on the username you defined in BotFather. The bot will respond with a welcome message and instructions on how to use it.  
Reminder: everyone with the link to your bot can use it, but you should NEVER share the token or API ID/API Hash publicly.

## Supported platforms

### Providers

- **ytdlp**: Download videos and audios from many websites, including YouTube, SoundCloud, Instagram, TikTok [and more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

### Subproviders

> You can send to the bot a link from any subprovider and it will automatically search for it on another supported provider.

- Apple Music
- Spotify
- Deezer
- Tidal
- Amazon Music
- Song.link

## License

MIT © [Johan](https://johanstick.fr/). [Support this project](https://johanstick.fr/#donate) if you want to help me 💙