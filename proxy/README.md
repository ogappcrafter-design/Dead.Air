# Infinite Signal proxy

Generates one Dead Air Radio call per request. The app calls this; the app never
calls the Anthropic API directly, and the API key never ships in the client
bundle.

## Why it isn't a passthrough

An earlier design in the v1 README proxied `POST /v1/messages` straight through.
That makes the deployment an open, unmetered Claude endpoint for anyone who
finds the URL. This service instead exposes a single narrow route:

```
POST /v1/signal
{ "bandId": 2, "recentNames": ["GUARDIAN", "GRAND"] }
```

The prompt is assembled server-side from `bands.js` and `prompt.js`. `bandId`
must index a known band; `recentNames` is truncated and stripped of newlines
before it is interpolated. Nothing else the client sends reaches the model.

The response is `{ "call": { ... } }`, shaped by the structured-output schema in
`prompt.js`. The app clamps every field again on receipt — see
`src/engine/generation.js`.

## Model configuration

- `claude-opus-5`, adaptive thinking at `low` effort — these are short creative
  generations, and low effort keeps latency inside what a player will wait for.
- Structured outputs (`output_config.format`) rather than "return only JSON"
  in the prompt, so the response is parseable by construction.
- Server-side fallbacks are on (`fallbacks: "default"`). Horror fiction sits
  near enough to the safety classifiers that a refusal is worth routing around;
  a refusal that survives the fallback returns `422` and the app shows
  `SIGNAL LOST`.

## Deploy to Cloud Run

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com

echo -n "YOUR_ANTHROPIC_API_KEY" | gcloud secrets create anthropic-api-key --data-file=-

gcloud run deploy dead-air-proxy \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets ANTHROPIC_API_KEY=anthropic-api-key:latest
```

Then point the app at it — set `expo.extra.signalProxyUrl` in `app.json` to the
deployed URL (no trailing slash). Until that is set, the Generate button in the
app reports that Infinite Signal is not configured rather than failing at the
network layer.

## Environment

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes | — | Read by the SDK. |
| `PORT` | no | `8080` | Cloud Run sets this. |
| `RATE_LIMIT_PER_MIN` | no | `10` | Per-IP token bucket. |

The bucket is in-process, so it resets on cold start and is per-instance. It
stops casual scraping; for real traffic put a gateway or Cloud Armor in front.

## Local run

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start
curl -s localhost:8080/v1/signal -H 'content-type: application/json' -d '{"bandId":2}' | jq
```
