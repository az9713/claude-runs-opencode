---
name: llmbench
description: Full LLM benchmark pipeline — runs same prompt across 4 models in parallel via OpenCode, then renders a 2x2 grid comparison video using Remotion.
arguments: The creative prompt to send to all models.
allowed-tools: Bash, Read, Write
---

# LLM Benchmark Pipeline

Full pipeline: parallel model testing + Remotion 2x2 grid video comparison.

## Default Models

- `openrouter/z-ai/glm-5` -> `llmtest/game-glm5.html`
- `openrouter/minimax/minimax-m2.5` -> `llmtest/game-minimax25.html`
- `openrouter/google/gemini-3-pro-preview` -> `llmtest/game-gemini3pro.html`
- `openrouter/anthropic/claude-opus-4.6` -> `llmtest/game-opus46.html`

## Pipeline Stages

### Stage 1: Parallel Model Execution

1. Source environment: `set -a && source .env 2>/dev/null; set +a`
2. Clean previous outputs in `llmtest/`
3. Run all 4 models in parallel as background processes:

```bash
opencode run -m openrouter/z-ai/glm-5 "$PROMPT Save the complete file as llmtest/game-glm5.html" > /tmp/opencode-glm5.log 2>&1 &
PID1=$!
opencode run -m openrouter/minimax/minimax-m2.5 "$PROMPT Save the complete file as llmtest/game-minimax25.html" > /tmp/opencode-minimax25.log 2>&1 &
PID2=$!
opencode run -m openrouter/google/gemini-3-pro-preview "$PROMPT Save the complete file as llmtest/game-gemini3pro.html" > /tmp/opencode-gemini3pro.log 2>&1 &
PID3=$!
opencode run -m openrouter/anthropic/claude-opus-4.6 "$PROMPT Save the complete file as llmtest/game-opus46.html" > /tmp/opencode-opus46.log 2>&1 &
PID4=$!
wait $PID1 $PID2 $PID3 $PID4
```

4. Verify all 4 HTML files exist and are >1KB

### Stage 2: Copy HTML to Remotion

```bash
cp llmtest/game-*.html remotion/public/
```

### Stage 3: Render Video

```bash
cd remotion && npx remotion render index.ts GridComparison ../out/comparison.mp4 --concurrency=1 --timeout=90000 --public-dir=public
```

- `--concurrency=1` is required because HTML files use requestAnimationFrame canvas animations
- Remotion can't sync with those, so sequential single-tab rendering lets animations advance naturally

### Stage 4: Verify Output

1. Check `out/comparison.mp4` exists
2. Report file size
3. Report success/failure

## Important Notes

- Remotion must be installed first: `cd remotion && npm install`
- The HTML files must use only vanilla HTML/CSS/JS (no external dependencies)
- Video output: 1920x1080, 30fps, 30 seconds (900 frames)
- Each quadrant shows one model's output with a label bar at the bottom
