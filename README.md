# Role Icon Maker for Discord

Design your own Discord **role icon** in the browser: pick a shape, colors, an emoji, text, a symbol or your own image, add a border, shadow or gloss, preview it exactly where Discord shows it, and download a PNG that is ready to upload.

![Role Icon Maker screenshot](docs/screenshot.png)

## Features

- **Shapes**: circle, rounded square, square, squircle, hexagon, shield, diamond, star, heart, badge, or no background at all.
- **Fills**: solid color, linear gradient with angle, radial gradient, plus Discord's default role color palette as one-click swatches.
- **Content**: 280+ curated emoji (paste any other emoji), text or initials in nine fonts with outline and letter spacing, 18 built-in symbols, or an uploaded image (PNG, JPG, GIF, WebP, SVG) that stays in your browser.
- **Effects**: border, drop shadow, glossy highlight, content shadow, and full placement control (size, offset, rotation, opacity).
- **Live Discord preview**: a chat message and a member list in dark and light themes, with your own username, role name and role color.
- **Export**: PNG at 64, 128, 256 or 512 px with a live file-size estimate and a warning when it would exceed Discord's 256 KB limit. Copy to clipboard or download.
- **Presets, randomize, share links**: start from 12 presets, roll a random design, and share a design as a URL. Your work is saved locally between visits.

## Use it in Discord

1. Download the PNG (256 px is a good default).
2. In Discord open **Server Settings → Roles**, pick the role, then **Display → Role Icon** and upload the file.
3. Requirements set by Discord: the server needs **Boost Level 2**, and the icon must be at least **64×64 px**, square, **PNG or JPG**, and under **256 KB**. Animated icons are not supported. Discord shows the icon at about 20 px next to member names, so bold, simple designs work best.

## Run it locally

```bash
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173). Other scripts:

```bash
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
npm test           # unit tests (Vitest)
npm run typecheck  # tsc only
npm run smoke      # headless browser smoke test, see below
```

The smoke test drives the built app in headless Chromium: it checks rendering, a control change, a real PNG download, the share link, presets, persistence and the mobile layout, and refreshes `docs/screenshot.png`. It needs a Playwright install that is not part of this project:

```bash
npm run build
npx playwright install chromium          # once
PLAYWRIGHT_MODULE_DIR=$(npm root -g) npm run smoke
```

`PLAYWRIGHT_MODULE_DIR` points at a directory that contains the `playwright` package (a global `npm install -g playwright` works).

## Deploy to Vercel

Import the repository in Vercel. `vercel.json` already declares the Vite framework, the build command and the `dist` output, so no settings are needed. Every push to the production branch deploys automatically. Alternatively run `npx vercel` from a checkout.

The app is fully static; any static host works with the contents of `dist/`.

## How it works

- A single canvas renderer (`src/render/renderIcon.ts`) draws the icon at any pixel size from normalized coordinates, so the big preview, the tiny Discord mock previews, the preset thumbnails and the exported PNG are pixel-identical.
- Emoji artwork comes from [Twemoji](https://github.com/jdecked/twemoji), loaded from jsDelivr and re-served as same-origin blobs so the canvas never gets tainted. If the CDN is unreachable the system emoji font is used and the export tab says so.
- Fonts come from Google Fonts. Uploaded images are downscaled to at most 1024 px and kept as data URLs in `localStorage`.
- Share links encode the design in the URL hash (uploaded images are left out).

Stack: Vite, React, TypeScript, no UI framework, Vitest for the pure logic.

## Credits and disclaimer

Emoji artwork by [Twemoji](https://github.com/jdecked/twemoji), licensed CC-BY 4.0. Fonts served by Google Fonts. Not affiliated with Discord Inc.; Discord is a trademark of Discord Inc. The Discord-style previews are original CSS mock-ups.
