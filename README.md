# 📻 DEAD AIR RADIO

> *Something is trying to reach you. The signal is forming.*

A paranormal late-night radio game for Android. You are the DJ. The calls are real.

---

## Overview

**Dead Air Radio** is an atmospheric horror mobile game built in React (via Expo/React Native Web). Players operate a late-night radio station that receives transmissions from the dead, classified sources, time loops, and things with no name.

Answer the call. Or don't. Either way, something heard you.

---

## Features

- **18 hand-crafted transmissions** across 5 unlockable frequency bands
- **5 call types:** Just Listen, Dead Air, Right Answer, Signal Decode, Stay Calm
- **Sanity + Static economy** — your choices have weight
- **15-tape archive** to collect across a full playthrough
- **Infinite Signal mode** — AI-generated calls via Claude API once the base game is complete
- **Persistent save system** — picks up exactly where you left off
- **Two-tier IAP:** base game ($0.99) and Infinite Signal expansion ($3.99)
- Fully mobile-optimized, CRT scanline aesthetic, no ads

---

## Frequency Bands

| Band | Freq | Unlocks At |
|---|---|---|
| LIVING | 88.7 FM | Start |
| LIMINAL | 102.3 FM | 4 calls |
| LOST | 117.8 AM | 8 calls |
| CLASSIFIED | ███.█ FM | 12 calls |
| ████████ | ???.? | 15 calls |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Expo / React Native Web) |
| AI (Infinite Mode) | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Billing | Google Play Billing Library v6 |
| Save / Storage | `window.storage` (persistent key-value) |
| Hosting / Backend | Google Cloud Run (optional, for API key proxy) |
| Distribution | Google Play Store |

---

## Google Cloud Project Setup

### 1. Create Your Project

```bash
gcloud projects create dead-air-radio --name="Dead Air Radio"
gcloud config set project dead-air-radio
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

### 3. Store Your Anthropic API Key Securely

```bash
echo -n "YOUR_ANTHROPIC_API_KEY" | \
  gcloud secrets create anthropic-api-key --data-file=-
```

### 4. Deploy API Proxy to Cloud Run (Recommended)

Create a lightweight proxy so your API key never ships in the client bundle:

```bash
# /proxy/index.js — minimal Express proxy
const express = require('express');
const app = express();
app.use(express.json());

app.post('/v1/messages', async (req, res) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(req.body)
  });
  const data = await response.json();
  res.json(data);
});

app.listen(8080);
```

```bash
gcloud run deploy dead-air-proxy \
  --source ./proxy \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets ANTHROPIC_API_KEY=anthropic-api-key:latest
```

Then update the fetch URL in `DeadAirRadio.jsx`:
```js
// Change this line in generateAICall():
const response = await fetch("https://YOUR-CLOUD-RUN-URL/v1/messages", {
```

---

## Google Play Store Setup

### In-App Products (Billing)

Set up two one-time purchase products in the **Google Play Console → Monetize → Products → In-app products**:

| Product ID | Title | Price |
|---|---|---|
| `dead_air_base` | Dead Air Radio | $0.99 |
| `dead_air_infinite` | Infinite Signal | $3.99 |

### Connecting Google Play Billing

The in-app store UI is fully built. To wire it to real Google Play Billing, replace the `buy()` simulation in the `Store` component with your `react-native-purchases` or `@react-native-google-play/billing` integration:

```js
// Replace the simulated buy() in Store component:
import Purchases from 'react-native-purchases';

const buy = async (product) => {
  try {
    const productId = product === 'base' ? 'dead_air_base' : 'dead_air_infinite';
    await Purchases.purchaseProduct(productId);
    onPurchase(product);
  } catch (e) {
    if (!e.userCancelled) console.error(e);
  }
};

// And restore purchases:
const restore = async () => {
  await Purchases.restorePurchases();
  onPurchase('restore');
};
```

---

## Local Development

```bash
# Install dependencies
npm install

# Run in browser (dev)
npx expo start --web

# Build for Android
npx expo build:android
# or with EAS:
eas build --platform android
```

---

## Environment Variables

```env
ANTHROPIC_API_KEY=your_key_here          # Only needed if NOT using Cloud Run proxy
CLOUD_RUN_PROXY_URL=https://your-url     # Your deployed proxy endpoint
```

---

## Save System

Game state saves automatically after every completed call via `window.storage` (persistent key-value):

- `dead_air_save_v1` — sanity, static balance, completed calls, tapes, gen count
- `dead_air_purchases_v1` — IAP unlock state

On boot, save data loads before the first screen renders. Players resume exactly where they left off.

---

## Project Structure

```
/
├── DeadAirRadio.jsx       # Full game (single-component build)
├── proxy/
│   └── index.js           # Cloud Run API key proxy
├── assets/
│   └── icon.png           # App icon (1024x1024)
├── app.json               # Expo config
├── google-services.json   # Firebase/Play config (add yours)
└── README.md
```

---

## Play Store Listing Copy

**Short description (80 chars):**
> A paranormal radio game. Answer the calls. Something is listening.

**Full description:**
> You are a late-night DJ. The calls are not normal.
>
> DEAD AIR RADIO is an atmospheric horror game about the people — and things — that call in after midnight. The dead. The classified. The ones stuck in loops. And something older than radio itself.
>
> Answer every call. Collect every tape. And whatever you do — don't hang up.
>
> ◈ 18 hand-crafted transmissions
> ◉ 5 unlockable frequency bands
> ◇ Sanity system that responds to every choice
> ◎ 15 collectible archive tapes
> ◊ Infinite Signal mode — AI-generated calls, endless, never the same twice
>
> No ads. No energy timers. Just the signal.

---

## Content Warnings

This game contains themes of grief, death, loss, the supernatural, and psychological horror. Some transmissions are based on emotionally real scenarios.

---

## License

All original content © Dead Air Radio. All rights reserved.  
Not for redistribution without permission.

---

*The frequency is open. Something is already waiting.*