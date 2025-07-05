# Base image for building the application
FROM alpine:3.21 AS builder

RUN apk update && apk add --no-cache \
    curl \
    wget \
    git \
    python3 \
    py3-pip \
    nodejs \
    npm \
    ffmpeg \
    build-base \
    python3-dev \
    libffi-dev \
    openssl-dev \
    && rm -rf /var/cache/apk/*

RUN pip3 install --no-cache-dir yt-dlp --break-system-packages

WORKDIR /app
COPY package.json ./
RUN npm install

# Final image
FROM alpine:3.21

ENV NODE_VERSION=22
ENV PYTHONUNBUFFERED=1

RUN apk add --no-cache \
    nodejs \
    python3 \
    py3-pip \
    ffmpeg \
	&& pip3 install --no-cache-dir yt-dlp --break-system-packages \
	&& rm -rf /var/cache/apk/*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

CMD ["node", "index.js"]