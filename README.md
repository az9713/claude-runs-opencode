# Claude Code Runs OpenCode

**One prompt. Four LLMs. One comparison video. Fully autonomous.**

A Claude Code skill that orchestrates [OpenCode CLI](https://opencode.ai) to run the same creative prompt across 4 different LLM models in parallel via [OpenRouter](https://openrouter.ai), then renders the outputs into a side-by-side 2x2 grid comparison video using [Remotion](https://www.remotion.dev/).

```
/llmbench Create a retro arcade space battle with pixel-art spaceships...
```

https://github.com/user-attachments/assets/b5e720d7-06a0-4c78-874d-8db4edcfd9a3

*GLM-5 vs MiniMax M2.5 vs Gemini 3 Pro vs Claude Opus 4.6 — same prompt, same time, side by side.*

```
     Claude Code (Opus 4.6)
        │
        ├── opencode run → GLM-5           → game-glm5.html
        ├── opencode run → MiniMax M2.5    → game-minimax25.html
        ├── opencode run → Gemini 3 Pro    → game-gemini3pro.html
        └── opencode run → Claude Opus 4.6 → game-opus46.html
                  (all 4 in parallel)
                          │
                          ▼
              Remotion renders 2x2 grid
                          │
                          ▼
                 out/comparison.mp4
              1920x1080 · 30fps · 30s
```

---

## What Makes This Interesting

### Tool-in-Tool Architecture

This is **an AI agent controlling another AI tool**. Claude Code (the orchestrator) launches OpenCode (the model runner) as subprocesses. Neither tool could do this alone:

- **OpenCode** can call any model on OpenRouter but can't orchestrate parallel runs of itself, chain multi-stage pipelines, or build infrastructure
- **Claude Code** can orchestrate anything but can only call Claude models natively — it can't call GLM-5, MiniMax, or Gemini directly

Together they cover both sides: Claude Code provides the orchestration intelligence, OpenCode provides multi-model access at OpenRouter pricing.

### The Full Pipeline in One Command

The `/llmbench` skill executes a 4-stage pipeline:

| Stage | What Happens |
|-------|-------------|
| **1. Model Execution** | 4 parallel `opencode run` background processes, each sending the same prompt to a different model. Each model writes a standalone HTML file. |
| **2. Staging** | HTML files are copied to `remotion/public/` where Remotion can serve them. |
| **3. Video Render** | Remotion opens a headless Chromium, loads all 4 HTML files into iframes in a 2x2 React component, captures 900 sequential screenshots as the canvas animations play, then stitches them into an MP4 via ffmpeg. |
| **4. Verification** | Confirms the MP4 exists and reports the file size. |

### Why `--concurrency=1` Matters

The HTML outputs use `requestAnimationFrame` canvas animations. With parallel rendering, each new browser tab would restart the animation from frame 0, desyncing from Remotion's frame counter. Sequential single-tab rendering (`--concurrency=1`) keeps the game animations and video frames naturally synchronized — slower to render (~3 min vs ~30s), but the output is correct.

---

## Models Tested

| Model | Provider | Output |
|-------|----------|--------|
| GLM-5 | Zhipu AI | `game-glm5.html` |
| MiniMax M2.5 | MiniMax | `game-minimax25.html` |
| Gemini 3 Pro Preview | Google | `game-gemini3pro.html` |
| Claude Opus 4.6 | Anthropic | `game-opus46.html` |

All accessed via OpenRouter. Models can be swapped by editing the skill file.

---

## Codebase

The repo has two main pieces: a **skill** (Markdown instructions that Claude Code reads and follows) and a **Remotion project** (a React/TypeScript app that turns HTML files into video).

| Component | What It Is | Key Files |
|-----------|-----------|-----------|
| **Skill** | A Markdown instruction file — not compiled code. When you type `/llmbench`, Claude Code loads it, interprets the steps, and executes them. | `.claude/skills/llmbench/SKILL.md` |
| **Remotion project** | A minimal React app that lays out 4 iframes in a 2x2 grid with model labels. Remotion renders it frame-by-frame in headless Chromium, then ffmpeg stitches the frames into MP4. | `remotion/GridComparison.tsx` (layout), `Root.tsx` (video config), `index.ts` (entry point) |
| **Pipeline outputs** | Generated at runtime, not checked in. HTML files from each model land in `llmtest/`, the final video in `out/`. | `llmtest/game-*.html`, `out/comparison.mp4` |

```
.
├── .claude/skills/llmbench/
│   └── SKILL.md               # The skill — instructions Claude Code follows
├── remotion/
│   ├── GridComparison.tsx      # 2x2 grid component (IFrames + model labels)
│   ├── Root.tsx                # Composition: 1920x1080, 30fps, 900 frames
│   ├── index.ts                # Entry point
│   ├── package.json            # Remotion + React dependencies
│   └── tsconfig.json           # TypeScript config
├── llmtest/                    # Model HTML outputs (gitignored)
├── out/                        # Rendered video (gitignored)
├── HOW_IT_WORKS.md             # Full build story and deep dive
├── CLAUDE.md                   # Project context for Claude Code sessions
└── .gitignore
```

---

## Quick Start

### Prerequisites

| Tool | Install |
|------|---------|
| Node.js 16+ | https://nodejs.org |
| OpenCode CLI | `npm i -g opencode` |
| OpenRouter API key | https://openrouter.ai |
| Claude Code | https://docs.anthropic.com/en/docs/claude-code |

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/allaboutai-org/claude_code_runs_open_code.git
cd claude_code_runs_open_code

# 2. Install Remotion dependencies
cd remotion && npm install && cd ..

# 3. Connect OpenRouter to OpenCode
# Option A: TUI (may have paste issues on Windows)
opencode    # then /connect → OpenRouter → paste API key

# Option B: Edit auth.json directly (recommended on Windows)
# File: ~/.local/share/opencode/auth.json
# Add: "openrouter": { "type": "api", "key": "your-key" }

# 4. Verify connection
opencode auth ls              # Should show OpenRouter
opencode models openrouter    # Should list models
```

### Run

From Claude Code:

```
/llmbench Create a single HTML file with a full-screen animated retro arcade
space battle scene. Use only HTML, CSS, and vanilla JavaScript. Show a pixel-art
spaceship firing lasers at waves of alien invaders. Use canvas.
```

Or run manually:

```bash
# Run 4 models in parallel
opencode run -m openrouter/z-ai/glm-5 "prompt... Save as llmtest/game-glm5.html" &
opencode run -m openrouter/minimax/minimax-m2.5 "prompt... Save as llmtest/game-minimax25.html" &
opencode run -m openrouter/google/gemini-3-pro-preview "prompt... Save as llmtest/game-gemini3pro.html" &
opencode run -m openrouter/anthropic/claude-opus-4.6 "prompt... Save as llmtest/game-opus46.html" &
wait

# Stage and render
cp llmtest/game-*.html remotion/public/
cd remotion && npx remotion render index.ts GridComparison ../out/comparison.mp4 \
  --concurrency=1 --timeout=90000 --public-dir=public
```

Output: `out/comparison.mp4` (32MB, 1920x1080, 30fps, 30s)

---

## Cost

A full 4-model benchmark run costs roughly **$0.50 - $1.00** on OpenRouter, depending on model pricing and output length. The cheaper models (GLM-5, MiniMax) are a few cents each; Claude Opus is the most expensive at ~$0.30-0.60 per run.

---

## Documentation

See [`HOW_IT_WORKS.md`](HOW_IT_WORKS.md) for the full build story:
- How the Remotion video pipeline works (frame-by-frame breakdown)
- Every problem encountered and how it was solved
- Why Claude Code + OpenCode instead of either tool alone
- Architecture pros and cons
- Reproduction steps from scratch

---

## Acknowledgements

1. **Inspired by EJAE** — This project was inspired by the YouTube video ["How to Run OpenCode Inside an Autonomous Claude Code AI Agent"](https://www.youtube.com/watch?v=oG0jmaIlL1w&t=11s). The video demonstrated the tool-in-tool architecture on a Mac Mini, running OpenCode inside Claude Code to benchmark LLMs and produce comparison videos. This repo replicates and documents that workflow.

2. **Built by Claude Code (Opus 4.6) in practically one shot** — The entire workflow — skill creation, Remotion project scaffolding, OpenRouter authentication, parallel model execution, video rendering pipeline, and comprehensive documentation — was constructed by Claude Code powered by Anthropic's Opus 4.6 model in a single interactive session. The AI agent handled architecture decisions, debugging (billing errors, auth config, model name mapping, Windows TUI issues), and iterative documentation refinement autonomously.

---

## License

MIT
