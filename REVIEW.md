# Memdia — Technical & Product Review

*Reviewed 2026-07-04. Covers the full realtime voice pipeline (Deepgram STT → OpenRouter/Gemini LLM → ElevenLabs-via-fal TTS), session/billing logic, and codebase health. Items marked ✅ FIXED were implemented as part of this review; the rest are recommendations.*

---

## 1. Security

### 1.1 Deepgram master API key shipped to the browser — CRITICAL ✅ FIXED
`getDeepgramKeyFn` (`src/server/deepgram.fn.ts`) returned the raw `DEEPGRAM_API_KEY` to any authenticated client, which then opened the WebSocket with it. Anyone with an account could scrape the key from a network trace and run unlimited transcription on your bill.

**Fix applied:** the server fn now calls Deepgram's `POST /v1/auth/grant` and returns a short-lived JWT (10-minute TTL — long enough to cover a full session plus reconnects). The client connects with the `['bearer', token]` subprotocol and fetches a fresh token on every (re)connect. The master key never leaves the server.

### 1.2 Client-authoritative session timer — cost exposure ✅ FIXED
The 3/10-minute limits were enforced only by a browser `setInterval`; the server locked the session only when the client *chose* to call `updateSessionTimeFn` at the end. A modified client could keep a session alive indefinitely — every extra turn is billable LLM + TTS.

**Fix applied:** `/api/stream/conversation` now rejects (403) any turn for a session whose age exceeds `maxDuration + 60s` grace, or whose status is no longer active. The client timer stays as the UX; the server is now the authority on cost.

### 1.3 Remaining recommendations
- `requireEmailVerification: false` in `src/lib/auth.ts` — flip to `true` before serious launch (the comment already says so).
- `.env.example` shipped `MOCK_PAYMENTS=true` — anyone deploying from the example silently gets free Pro for all users. ✅ FIXED (example now defaults to `false` with a clear comment).
- Rate-limit `preGenerateGreetingFn` and the grant-token fn per user (cheap `Map`-based limiter is fine) — both are callable at will by any logged-in client.

---

## 2. Cost (~$0.55–0.65 / 13 min ≈ $0.045/min today)

Where the money goes, per turn:

| Component | Call pattern | Est. share |
|---|---|---|
| ElevenLabs Turbo v2.5 via fal.ai | **One TTS job per sentence** of every AI reply | **~70–85%** |
| Deepgram nova-3 streaming | Continuous WS while user may speak | ~10–20% |
| Gemini Flash via OpenRouter | 1 streamed completion/turn, full history each time | ~2–5% |
| Session-end (summary + image scene + ImagineArt image + Bunny) | Once/session | small |

### Recommendations (not implemented — product decisions)
1. **Swap TTS vendor.** ElevenLabs-via-fal is the premium-price option. Deepgram **Aura-2** (~$0.030/1k chars) is roughly 5–10× cheaper and consolidates STT+TTS on one vendor/one WS ecosystem; Cartesia Sonic is the other strong low-latency option. This single change likely cuts your per-user cost by more than half. (The new self-hosted project — see `C:\Users\User\parla` — drives marginal TTS cost to ~zero; learnings can back-port.)
2. **Window the LLM history.** Every turn currently sends the *entire* conversation. For a 3-min session it's minor; for 10-min reflections the token count compounds. Keep the last ~12 turns verbatim + a running one-line summary.
3. **Batch short sentences before TTS.** The per-sentence fan-out is great for latency but bills a separate job for "Okay." / "I see." — merge sentences under ~40 chars into the next chunk.

---

## 3. Latency

Current voice-to-voice dead time is dominated by the *end-of-utterance detection tail*, not the AI:

| Source | Was | Now |
|---|---|---|
| Deepgram `utterance_end_ms` | 1500ms | **1000ms** ✅ FIXED |
| Deepgram `endpointing` | 400ms | kept at 400ms — code comment shows 300ms previously caused premature utterance cutoffs |
| Keepalive grace after AI speech | 2000ms | **1000ms** ✅ FIXED |
| `endMutation` sequential awaits | serial | **parallel** ✅ FIXED |

### Remaining recommendations
- **`ScriptProcessorNode` → `AudioWorklet`** in `useAudioRecorder.ts`. The deprecated node runs on the main thread; UI jank (the Three.js visualizer!) can delay audio chunks. Also lower `chunkInterval` 250ms → 100ms when you do this.
- **fal streaming is often not streaming.** `falai-streaming.service.ts` frequently accumulates all chunks and yields once, or falls back to fetching the audio URL server-side and base64-encoding — a full extra round-trip per sentence. If you keep fal, request raw binary and pipe chunks straight through; if you switch to Deepgram Aura/Cartesia, use their native WS streaming.
- Consider Deepgram's `interim_results` + a speculative LLM start: begin the LLM request on `is_final` and cancel if the user keeps talking. Saves the endpointing tail entirely on most turns. (Bigger change; measure first.)

---

## 4. Dead / broken code ✅ FIXED (deleted or repaired)

- **Entire WebSocket stack was dead** (~950 lines): `server/routes/api/ws/conversation.ts` + `src/hooks/useVoiceConversation.ts` were never mounted/imported — and contained divergent copies of greeting/LLM/TTS logic. **Deleted.**
- **Legacy blocking path**: `streaming.fn.ts` (`streamMessageFn`) and `sendMessageFn` were reachable only behind `USE_SSE_STREAMING = false`. **Deleted**, SSE is now the only path.
- **`extractSentences` was copy-pasted in 3 files.** Consolidated into `src/lib/sentences.ts`.
- **`/pricing` route showed template boilerplate** ("AppStarter", fake Free/Pro/Enterprise tiers, "Start Free Trial" — there is no free tier). Now renders the real `PricingSection` (single source of truth with the landing page).
- **Mute button was a no-op** (`handleToggleMute` logged a TODO). Now actually gates mic PCM forwarding to Deepgram.
- **VAD loaded from jsDelivr CDN** at versions (vad-web 0.0.29 / onnxruntime 1.22.0) that didn't match package.json (0.0.30 / 1.23.2) — a CDN outage silently disabled barge-in. Now served from the app itself.
- **`.env.example` comments contradicted the code** (said nova-2 / eleven-v3 / imagineart-1.5; code uses nova-3 / turbo-v2.5 / imagineart-2.0). Corrected.
- `public/manifest.json` still said "TanStack App". Corrected to Memdia branding.

### Still worth doing (not done — larger refactors)
- `README.md` is still the generic starter-template doc (describes a `/dashboard` that doesn't exist). Rewrite it for Memdia; `CLAUDE.md` is currently the only accurate doc.
- `memories.today.tsx` (1465 lines) and `reflections.today.tsx` (1384 lines) are near-duplicate god-components. Extract a shared `useVoiceSession` orchestrator hook + shared UI; the two screens should differ only in config (duration, prompts, extraction).
- The Memories/Reflections duplication runs all the way down (schema models, fns, greeting caches, attempt tracking). When you next touch this area, unify behind a `sessionType` discriminator.
- The SSE route probes both `voiceSession` and `reflectionSession` tables on every request — pass the session type from the client instead.
- Heavy `console.log` debris in the voice path (~40 in each today-screen, 30 in `useDeepgramSTT`) — gate behind a `DEBUG_VOICE` flag.

---

## 5. Product / feature ideas (not implemented)

**Conversation quality**
- **More personas.** Only `empathetic` and `curious` exist. Personas are cheap (system prompt + TTS voice) and highly marketable. Give each a name, voice, and avatar.
- **Cross-session memory for Memories.** Reflections get a `contextBrief`; the daily 3-min check-in has amnesia. "Yesterday you mentioned the job interview — how did it go?" is the single most magical thing this app could do, and the extraction pipeline you already built for Insights provides the data.
- **Voice choice.** One hardcoded voice ("Rachel"). Let users pick.
- **Smarter greeting.** Greetings are random canned strings. Generate them from yesterday's summary (you already cache greetings per-day, so this costs one LLM call per user per day).

**Engagement / retention**
- Streaks + gentle push/email reminder at the user's preferred time (you already store timezone).
- Weekly recap email: summary of the week's moods/topics + the memory images — shareable, viral surface.
- Make the PWA real (manifest is now fixed; add a service worker + install prompt) — a home-screen icon matters a lot for a daily-habit product.

**Monetization**
- A limited free tier (e.g. 1-min check-in, no image) would fix top-of-funnel; today a new user hits a paywall before ever hearing the product's magic.
- Overage/top-up minutes once server-side time enforcement (done) makes minutes trustworthy.

---

## 6. Architecture verdict

The core design is genuinely good: streamed LLM → per-sentence TTS fan-out → gapless Web Audio scheduling, pre-generated cached greetings, Silero barge-in with triple-redundant cancellation (client audio stop + client generation bump + server generation bump). That is the right shape for a realtime voice product, and it shows in the UX.

The three structural weaknesses were: (1) trusting the client (keys + timer) — now fixed; (2) paying premium per-sentence TTS retail — vendor decision, see §2; (3) two parallel implementations of everything (WS+SSE, Memories+Reflections) — half deleted, half remains as the main refactor debt.
