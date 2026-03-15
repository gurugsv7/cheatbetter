# Product Requirements Document — GSV

## Overview

GSV is an Electron-based real-time AI assistant that helps students and professionals prepare for high-stakes situations: job interviews, presentations, negotiations, exams. The platform captures screen and audio context and provides AI-powered guidance through an always-on-top overlay.

---

## Core Features

### 1. Real-Time AI Overlay
- Transparent, repositionable window that sits above all other applications
- Powered by student's choice of AI provider (Gemini, Groq, Azure OpenAI, or local Ollama)
- Click-through mode allows keyboard-only control without mouse interference
- Full keyboard navigation and response history

### 2. Session Profiles
Pre-tuned prompt profiles for contextual assistance:
- **Job Interview** — Technical and behavioral answer scaffolding
- **Sales Call** — Real-time objection handling
- **Business Meeting** — Professional communication support
- **Presentation** — Confident speaker scripts and talking points
- **Negotiation** — Tactical language and composed responses
- **Exam Assistant** — Step-by-step problem solving

### 3. Audio & Visual Context
- **Continuous audio capture** — Microphone, speaker, both, or none
- **Automatic screenshot analysis** — Periodic screen captures provide visual context
- **Manual screen analysis** — On-demand screen parsing for problem solving
- **Voice calibration** — Pre-session voice profiling for personalized AI tone

### 4. Context Management
- **Resume upload** — PDF/DOCX import; text silently injected into prompt context
- **Custom instructions** — Add job descriptions, company details, constraints
- **30+ languages** — Multi-language speech recognition and response
- **Theme and accessibility** — Dark mode, configurable opacity, monospace typography

---

## Planned Features

### SA Round Simulator

A dedicated practice tool for Data Structure & Algorithm (DSA) interview rounds. Students practice explaining their solution approach out loud while simultaneously writing code or pseudo-code, simulating the live round experience.

#### User Flow
1. **Role Selection** — Student picks their target role (e.g., "SDE at TCS", "Backend Engineer at Startup", "Data Engineer at Freshworks")
2. **Problem Assignment** — Platform retrieves 1–2 calibrated DSA problems matched to that company's actual interview difficulty (not LeetCode arbitrary levels, but _real_ company data)
3. **Live Round** — Student has chosen time limit (typically 45–60 min) to:
   - Talk through their approach out loud
   - Write pseudo-code or full solution on screen
   - System records audio the entire session
4. **AI Coaching** — Optional real-time overlay coaching (same as main GSV features) to help guide approach selection or spot errors

#### Metrics & Scoring

Real-time voice analysis (using transcription + NLP) measures:

- **Problem Clarification** — Did student ask clarifying questions before jumping to code?
- **Approach Communication** — Did student explain their algorithm before writing code?
- **Silence & Filler Analysis** — Detects thinking gaps, "umm/uh" count, long pauses (flags panic or confusion)
- **Complexity Discussion** — Did student mention or calculate time/space complexity?
- **Panic Recovery** — How did the student react when stuck? Did they vocalize workarounds or give up?

#### Post-Round Report Card

Same report structure as behavioral rounds, but for coding performance:

- **Communication Score** — Clarity of explanation, completeness of problem walkthrough
- **Approach Structure Score** — Quality of algorithm selection, optimization awareness, scalability thinking
- **Time Management Score** — Pacing through problem, time spent on clarification vs. coding vs. edge cases
- **Panic Recovery Score** — Composure when stuck, ability to pivot, willingness to ask for hints/guidance

#### Technical Requirements

- **DSA Problem Database** — Curated set of ~100–200 problems keyed by company and difficulty tier
- **Audio Recording & Analysis** — Continuous voice capture; transcription via Whisper (local or cloud)
- **Real-Time Transcription** — Feed transcript fragments to NLP for tone/filler detection
- **Complexity Parser** — Optional code analysis to auto-detect if student mentioned or achieved stated complexity goals
- **Report Generation** — Styled report card matching existing behavioral interview format
- **Session Storage** — Store recorded session, transcript, solution code, and final report for playback and review

---

## Technical Architecture

### Audio & Processing
- Dual-stream audio capture: microphone + system audio (speaker/interviewer)
- 16 kHz resampling standard for Whisper compatibility
- Local transcription via Whisper.cpp (offline) or cloud STT (Azure / Gemini)
- Voice activity detection to skip silent segments
- Speaker diarization (optional tinydiarize for tracking speaker turns)

### AI & Context
- Modular AI provider abstraction: Gemini, Groq, Azure, Ollama
- Prompt injection system for custom instructions, resume context, company details
- Session profile prompt library
- Response streaming and history navigation

### Frontend
- React 19 with React Compiler (target)
- Shadcn/ui components for rebuilding legacy UI
- Tailwind CSS with CSS variables for theming
- Electron IPC with context isolation for security
- TypeScript strict mode

### Storage & Privacy
- Local-first architecture: transcriptions, recordings, and solutions stored locally by default
- Optional cloud upload with user consent
- Clear data retention policies and user-controllable deletion
- No persistent upload of sensitive data (resumes, code) without explicit permission

---

## Development Roadmap

### Phase 1: Foundation (Current)
- ✅ Basic overlay and real-time AI response
- ✅ Session profiles (Interview, Presentation, etc.)
- ✅ Audio capture and context injection
- 🎯 Local transcription integration (Whisper.cpp)
- 🎯 Dual audio stream support

### Phase 2: SA Round Simulator
- Problem database & company-tier mapping
- Audio recording & real-time transcription
- Silence/filler detection NLP
- Report card generation
- Session playback and review

### Phase 3: Polish & Scale
- Full TypeScript / React migration
- Comprehensive test coverage (Jest, RTL)
- Performance optimization
- International localization
- Enterprise Azure integration

---

## Success Metrics

- **User Engagement** — Daily active users; avg. session duration
- **Behavioral Interview** — User confidence ratings pre/post session; job offer conversion
- **SA Round** — Problem solved correctly; code quality vs. baseline; communication score trend
- **Retention** — Week-over-week return rate; practice frequency
- **Satisfaction** — NPS; feature request volume; bug reports

---
