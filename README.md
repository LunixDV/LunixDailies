# LunixDailies

LunixDailies is a simple Bun + Vite PWA that generates daily tailored informatics content with Groq and visuals from Pixabay.

## Features

- Installable PWA for Android and iOS (Add to Home Screen flow on iOS)
- Groq-powered daily content generation
- Pixabay image search integration (API key)
- Black and gold themed UI
- Native share support (Android/iOS where supported)
- File sharing via generated PNG card (with fallback download)
- Quick-share links for Telegram, WhatsApp, and X

## Setup

1. Install dependencies:

   bun install

2. Create environment file:

   Copy .env.example to .env and set VITE_GROQ_API_KEY and VITE_PIXABAY_API_KEY.

3. Run dev server:

   bun run dev

4. Build production app:

   bun run build

## Notes

- Native file share availability depends on browser and OS support for Web Share API Level 2.
- If Pixabay returns no results or the key is missing, the app falls back to a free generated image endpoint.
