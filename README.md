# GSV

> Real-time AI assistance during interviews, meetings, and presentations — invisible overlay, powered by your choice of AI.

GSV is an Electron desktop app that captures your screen and audio to deliver contextual, ready-to-speak AI responses in real time. It sits as a transparent, always-on-top overlay that you can reposition and hide instantly.

> [!NOTE]
> Use the latest macOS or Windows version. Older OS versions have limited support.

---

## Features

### AI Provider Modes

- **BYOK (Bring Your Own Key)** — Connect Gemini (Google AI Studio) or Groq with your own API keys. No data leaves your control.
- **Local AI** — Fully offline inference via [Ollama](https://ollama.com) (any model) with on-device speech-to-text via Whisper. No internet required after setup.
- **Azure** — Enterprise Azure OpenAI endpoint support.

### Session Profiles

Six pre-built prompt profiles, each tuned for the context:

- **Job Interview** — Ready-to-speak technical and behavioural answers in natural spoken English
- **Sales Call** — Real-time objection handling and pitch support
- **Business Meeting** — Clear, professional spoken responses
- **Presentation** — Confident, engaging presenter script
- **Negotiation** — Tactical, composed negotiation language
- **Exam Assistant** — Step-by-step problem solving and explanations

### Capture & Analysis

- **Continuous audio capture** — Speaker (interviewer), microphone (you), both, or none
- **Automatic screenshot analysis** — Periodic screen captures feed visual context to the AI
- **Manual screen analysis** — Analyse the current screen on demand to extract answers, code solutions, or context
- **Voice calibration** — Optional pre-session voice profiling so the AI learns your speech patterns

### Context Engine

- **Resume upload** — Import a PDF or DOCX resume; text is silently injected into the AI context at session start without cluttering the UI
- **Custom instructions** — Add job descriptions, company details, or extra constraints for the AI
- **30+ languages** — Speech recognition covers English (US/UK/AU/IN), German, French, Spanish, Hindi, Japanese, Chinese, Arabic, and more

### Overlay & UX

- **Transparent overlay** — Always-on-top window with configurable background opacity
- **Click-through mode** — Window becomes mouse-transparent so it never interferes with underlying apps
- **Keyboard-only control** — Full window management without touching the mouse
- **Response history** — Navigate back and forward through previous AI responses
- **Theme system** — Dark mode with configurable accent colours
- **Futuristic UI** — Cyan-on-dark aesthetic with monospace typography

---

## Setup

```bash
npm install
npm start
```

For **BYOK / Gemini** mode, get a free API key at [Google AI Studio](https://aistudio.google.com/apikey).

For **Groq** mode, get a key at [console.groq.com](https://console.groq.com).

For **Local AI** mode, install [Ollama](https://ollama.com) and pull any model (e.g. `ollama pull llama3.2`). Whisper is downloaded automatically on first session start.

---

## Usage

1. Launch the app with `npm start`
2. Select your AI provider mode on the start screen
3. Enter your API key (BYOK / Groq) or confirm Ollama is running (Local AI)
4. Go to **AI Context** to upload your resume and add custom instructions
5. Go to **Settings** to pick a profile, language, and audio mode
6. Click **Start Session**
7. The overlay appears — position it with keyboard shortcuts and let the AI respond in real time

---

## Keyboard Shortcuts

| Action | macOS | Windows / Linux |
|---|---|---|
| Move window | `Opt + Arrow Keys` | `Ctrl + Arrow Keys` |
| Toggle click-through | `Cmd + M` | `Ctrl + M` |
| Toggle visibility | `Cmd + \` | `Ctrl + \` |
| Previous response | `Cmd + [` | `Ctrl + [` |
| Next response | `Cmd + ]` | `Ctrl + ]` |
| Scroll response up | `Cmd + Shift + Up` | `Ctrl + Shift + Up` |
| Scroll response down | `Cmd + Shift + Down` | `Ctrl + Shift + Down` |
| Send text message | `Enter` | `Enter` |
| Ask next step | `Cmd + Enter` | `Ctrl + Enter` |

All shortcuts are fully rebindable in **Settings → Keyboard Shortcuts**.

---

## Audio Capture

| Platform | Method |
|---|---|
| macOS | [SystemAudioDump](https://github.com/Mohammed-Yasin-Mulla/Sound) for system audio |
| Windows | Loopback audio capture |
| Linux | Microphone input |

**Audio modes**: Speaker Only · Mic Only · Both · None (screenshots only)

---

## Requirements

- macOS, Windows, or Linux (macOS and Windows recommended)
- Node.js / npm for development
- Screen recording permission
- Microphone permission (if using mic capture)
- API key **or** a local Ollama installation

---

## License

GPL-3.0 — see [LICENSE](LICENSE).
