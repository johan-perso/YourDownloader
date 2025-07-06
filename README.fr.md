###### English version [here](https://github.com/johan-perso/yourdownloader/blob/main/README.md).

# YourDownloader

Un bot Telegram permettant de télécharger des vidéos et fichiers audio depuis de nombreuses plateformes, avec la possibilité de rechercher pour des contenus depuis d'autres sous-fournisseurs. Open-source, gratuit sans publicités et hébergeable pour une meilleure confidentialité !

Ce projet utilise la librairie [Telegraf](https://telegraf.js.org/) pour interagir avec l'API Telegram, et utilise [ffmpeg](https://ffmpeg.org/) + [yt-dlp](https://github.com/yt-dlp/yt-dlp) pour télécharger et convertir les fichiers.

## Hébergement avec Docker

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) avec [Docker Compose](https://docs.docker.com/compose/install/)
- Un token de bot Telegram (obtenez-le en envoyant un message à [@BotFather](https://t.me/botfather))
- Un API ID et API Hash auprès de l'API Telegram (obtenez-le via [my.telegram.org](https://my.telegram.org/apps))
	- Vous n'êtes pas obligé d'entrer un "website" si demandé, et vous pouvez choisir "Desktop" comme plateforme supportée.

### Installation

1. Téléchargez le code source :
```bash
git clone https://github.com/johan-perso/yourdownloader.git
cd yourdownloader
```

2. Configurez les variables d'environnements :
```bash
cp .env.example .env
# Modifier le fichier .env avec les valeurs que vous avez obtenu via BotFather et my.telegram.org
```

3. Compilez et démarrez un conteneur Docker :
```bash
docker-compose up -d --build
```

### Accéder au bot

Vous pouvez désormais envoyer la commande `/start` à votre bot en fonction du nom d'utilisateur que vous avez défini dans BotFather. Le bot va répondre avec un message de bienvenue ainsi que des instructions sur son utilisation.  
Rappel : toute personne possédant le lien ou le pseudo de votre bot pourra l'utiliser, mais vous ne devez JAMAIS partager à quiconque son token ou son API ID / API Hash.

## Plateformes supportées

### Fournisseurs

- **ytdlp**: Télécharger des vidéos et fichiers audio depuis de nombreux sites comme YouTube, SoundCloud, Instagram, TikTok [et plus encore](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

### "Sous"-fournisseurs

> Vous pouvez envoyer au bot un lien depuis n'importe quel sous-fournisseur, et des informations seront extraites pour rechercher sur un autre fournisseur supporté.

- Apple Music
- Spotify
- Deezer
- Tidal
- Amazon Music
- Song.link

## Licence

MIT © [Johan](https://johanstick.fr). [Soutenez ce projet](https://johanstick.fr/#donate) si vous souhaitez m'aider 💙