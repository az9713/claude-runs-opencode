# CLAUDE.md

Project context for Claude Code sessions.

## What This Project Is

An LLM benchmark pipeline that uses Claude Code to orchestrate OpenCode CLI, running the same creative prompt across 4 models in parallel via OpenRouter, then rendering a 2x2 grid comparison video with Remotion.

## Key Skill

- **`/llmbench <prompt>`** — The only skill. Runs the full pipeline: prompt → 4 parallel model runs → HTML files → Remotion video → MP4 output.
- Skill file: `.claude/skills/llmbench/SKILL.md`

## Architecture

```
Claude Code (orchestrator)
  └── opencode run -m openrouter/<model> "prompt" (×4, parallel background processes)
        └── Each writes to llmtest/game-<name>.html
              └── Copied to remotion/public/
                    └── npx remotion render → out/comparison.mp4
```

## Models (via OpenRouter)

| Model ID | Output File |
|----------|------------|
| `openrouter/z-ai/glm-5` | `llmtest/game-glm5.html` |
| `openrouter/minimax/minimax-m2.5` | `llmtest/game-minimax25.html` |
| `openrouter/google/gemini-3-pro-preview` | `llmtest/game-gemini3pro.html` |
| `openrouter/anthropic/claude-opus-4.6` | `llmtest/game-opus46.html` |

## Directory Layout

| Directory | Purpose | Git tracked? |
|-----------|---------|-------------|
| `.claude/skills/llmbench/` | Skill definition | Yes |
| `remotion/` | Video rendering project (React/TypeScript) | Yes (except `node_modules/`, `public/*.html`) |
| `llmtest/` | Model HTML outputs | No (gitignored) |
| `out/` | Rendered MP4 video | No (gitignored) |
| `HOW_IT_WORKS.md` | Full build narrative and documentation | Yes |
| `.ignore/` | Sensitive files (API keys) | No (gitignored) |

## Critical Gotchas

1. **`--concurrency=1` is mandatory** for Remotion rendering. The HTML files use `requestAnimationFrame` canvas animations. Parallel rendering desyncs the animations from Remotion's frame counter.

2. **Model prefix matters**: Use `openrouter/` prefix (not `opencode/`). The `opencode/` prefix routes through OpenCode Zen billing, which is a separate paid service. `openrouter/` routes through the user's OpenRouter credit.

3. **OpenCode auth location**: `~/.local/share/opencode/auth.json`. On Windows: `%USERPROFILE%\.local\share\opencode\auth.json`. Add OpenRouter as a provider here if the TUI `/connect` command has paste issues.

4. **Model names differ** between OpenCode Zen and OpenRouter. Always verify with `opencode models openrouter | grep <name>`.

5. **HTML files must be vanilla** — no external dependencies, no npm packages. Models are instructed to use only HTML, CSS, and vanilla JavaScript with `<canvas>`.

## Remotion Project (`remotion/`)

5 files, minimal setup:
- `index.ts` — Entry point (`registerRoot`)
- `Root.tsx` — Composition registration (1920x1080, 30fps, 900 frames = 30s)
- `GridComparison.tsx` — 2x2 grid with `<IFrame>` per cell + model label bar
- `package.json` — remotion 4.0.261, react 18, typescript 5.7
- `tsconfig.json` — `jsx: "react-jsx"`

Install: `cd remotion && npm install`

## Running the Pipeline

```bash
# From Claude Code:
/llmbench <your creative prompt here>

# Or manually:
set -a && source .env 2>/dev/null; set +a
opencode run -m openrouter/z-ai/glm-5 "prompt... Save as llmtest/game-glm5.html" &
opencode run -m openrouter/minimax/minimax-m2.5 "prompt... Save as llmtest/game-minimax25.html" &
opencode run -m openrouter/google/gemini-3-pro-preview "prompt... Save as llmtest/game-gemini3pro.html" &
opencode run -m openrouter/anthropic/claude-opus-4.6 "prompt... Save as llmtest/game-opus46.html" &
wait
cp llmtest/game-*.html remotion/public/
cd remotion && npx remotion render index.ts GridComparison ../out/comparison.mp4 --concurrency=1 --timeout=90000 --public-dir=public
```

## Docs

- `HOW_IT_WORKS.md` — Full build narrative (14 sections, covers every problem and solution)
