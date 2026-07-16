# Webcam Streaming App — GE HealthCare MRI Live Stream

A Svelte 5 + Vite web app that streams a live video feed (standing in for an **MRI scanner** console) over **Solace PubSub+**, and lets a remote **Radiology Reading Room** subscribe and watch the feed in real time. Themed with GE HealthCare's "Compassion Purple" brand palette.

The architecture is adapted from the [aeroswift-ai web app](https://github.com/TKTheTechie/aeroswift-ai/tree/main/aersoswift-web-app) (Svelte + Solace + Tailwind), with the aviation/face-recognition features stripped out and replaced with a focused MRI video-streaming flow.

## How it works

- **Scanner Console** (`ScannerPublisher.svelte`) — captures frames from the camera and publishes them as JPEG binary attachments to a Solace topic at a configurable frame rate and quality. Each frame is sent with a small header: `frameId|timestamp|frameSize|<binary JPEG>`. Scanner status (sequence, slice index, FPS) is published as JSON on a separate status topic.
- **Reading Room** (`VideoFeedViewer.svelte`) — subscribes to the video topic, decodes each frame back into a data URL, and renders it live. It also subscribes to the status topic to show the active sequence/slice/FPS HUD.
- **`SolaceVideoClient`** (`src/lib/common/solace.ts`) — a thin wrapper over `solclientjs` handling connect/subscribe/publish, with a **demo mode** that simulates a synthetic MRI-style feed when no broker is available.

### Session IDs & QR codes

When `VITE_SESSION_ID_ENABLED=true`, the scanner appends a UUID to its video topic and renders a QR code that deep-links to `/?view=reading-room&sessionId=<uuid>` so a remote device can subscribe to that specific scanner. The route is carried as a query param on the root path (rather than a `/reading-room` subpath) so the QR link resolves on any static host without needing SPA rewrite rules.

## Getting started

```bash
npm install
cp .env.example .env      # then edit with your Solace broker details
npm run dev
```

Open the printed URL. Pick **Scanner Console** to start streaming, or **Reading Room** to watch.

### Demo mode (no broker required)

Set `VITE_DEMO_MODE=true` in `.env` to run the Reading Room against a locally-generated synthetic MRI feed.

## Configuration (`.env`)

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_SOLACE_URL` | Broker WebSocket URL | `ws://localhost:8008` |
| `VITE_SOLACE_VPN` | Message VPN | `default` |
| `VITE_SOLACE_USERNAME` | Client username | `default` |
| `VITE_SOLACE_PASSWORD` | Client password | `default` |
| `VITE_VIDEO_TOPIC` | Video frame topic | `gehc/mri/scanner/feed` |
| `VITE_STATUS_TOPIC` | Scanner status topic | `gehc/mri/scanner/status` |
| `VITE_DEMO_MODE` | Simulate feed without a broker | `false` |
| `VITE_SESSION_ID_ENABLED` | Append UUID + show QR code | `true` |

## Stack

- Svelte 5 (runes) + Vite
- Tailwind CSS (GE HealthCare purple theme)
- `solclientjs` for Solace PubSub+
- `qrcode`, `uuid`

## Note on branding

The GE HealthCare logo used here is a **stylized recreation** for demonstration purposes, not the official trademarked artwork. Replace `src/lib/GELogo.svelte` with official brand assets if using internally.
