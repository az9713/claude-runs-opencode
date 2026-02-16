# LLM Benchmark Pipeline — How It Works

## The Big Picture

```
                            "Create a retro arcade space battle..."
                                            │
                                            ▼
                                 ┌─────────────────────┐
                                 │    Claude Code       │
                                 │    (Orchestrator)    │
                                 └──────────┬──────────┘
                                            │  spawns 4 parallel processes
                        ┌───────────────────┼───────────────────┐
                        │                   │                   │
                        ▼                   ▼                   ▼
              ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
              │  opencode run   │ │  opencode run   │ │  opencode run   │  ...×4
              └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                       │                   │                   │
                       └───────────────────┼───────────────────┘
                                           │
                                           ▼
                                 ┌─────────────────────┐
                                 │     OpenRouter       │
                                 │   (API Gateway)      │
                                 └──────────┬──────────┘
                                            │  routes to 4 different providers
                  ┌─────────────────┬───────┴───────┬─────────────────┐
                  │                 │               │                 │
                  ▼                 ▼               ▼                 ▼
               GLM-5          MiniMax M2.5    Gemini 3 Pro       Opus 4.6
              (Zhipu AI)       (MiniMax)       (Google)         (Anthropic)
                  │                 │               │                 │
                  ▼                 ▼               ▼                 ▼
           game-glm5.html  game-minimax25   game-gemini3pro   game-opus46
                                .html            .html           .html
                  │                 │               │                 │
                  └─────────────────┴───────┬───────┴─────────────────┘
                                            │
                                            ▼  cp → remotion/public/
                                 ┌─────────────────────┐
                                 │      Remotion        │
                                 │  (Headless Chromium) │
                                 │                      │
                                 │  ┌────────┬────────┐ │
                                 │  │ GLM-5  │MiniMax │ │
                                 │  ├────────┼────────┤ │    × 900 frames
                                 │  │ Gemini │ Opus   │ │    (30fps × 30s)
                                 │  └────────┴────────┘ │
                                 │                      │
                                 │  screenshot → PNG    │
                                 └──────────┬───────────┘
                                            │
                                            ▼  ffmpeg stitches PNGs
                                 ┌─────────────────────┐
                                 │   comparison.mp4    │
                                 │   1920×1080 · 30s   │
                                 └─────────────────────┘
```

---

## Table of Contents

1. [Origin and Motivation](#1-origin-and-motivation)
2. [What We Set Out To Build](#2-what-we-set-out-to-build)
3. [Documents and References Read](#3-documents-and-references-read)
4. [Architecture Overview](#4-architecture-overview)
5. [How 4 HTML Files Become a Video (The Remotion Pipeline)](#5-how-4-html-files-become-a-video-the-remotion-pipeline)
6. [Step-by-Step Build Process](#6-step-by-step-build-process)
7. [The Skills: What Was Built and How They Work](#7-the-skills-what-was-built-and-how-they-work)
8. [Problems Encountered and Solutions](#8-problems-encountered-and-solutions)
9. [Why Claude Code Runs OpenCode (Not the Other Way Around)](#9-why-claude-code-runs-opencode-not-the-other-way-around)
10. [Pros and Cons of This Architecture](#10-pros-and-cons-of-this-architecture)
11. [File Inventory](#11-file-inventory)
12. [How to Reproduce From Scratch](#12-how-to-reproduce-from-scratch)
13. [Cost Analysis](#13-cost-analysis)
14. [Future Work](#14-future-work)

---

## 1. Origin and Motivation

This project replicates a workflow demonstrated in the **EJAE** YouTube video:
**"How to Run OpenCode Inside an Autonomous Claude Code AI Agent"**
(https://www.youtube.com/watch?v=oG0jmaIlL1w)

The video showed a system running on a **Mac Mini** where:
- Claude Code (Anthropic's CLI agent) orchestrates everything
- OpenCode (a separate AI coding CLI tool) is called as a subprocess
- The same creative prompt is sent to multiple LLM models in parallel via OpenRouter
- Each model generates an HTML file (a retro arcade space battle game)
- Remotion (a React-based video framework) renders all outputs into a 2x2 grid comparison video
- The video is posted to X/Twitter for public comparison

The key insight is **"tool-in-tool" architecture**: one autonomous AI agent (Claude Code) controlling another specialized agentic tool (OpenCode) to achieve a complex, multi-stage objective that neither tool could easily do alone.

---

## 2. What We Set Out To Build

### The Goal
Build a reusable skill pipeline that:
1. Takes a single creative prompt
2. Sends it to 4 different LLM models simultaneously
3. Each model generates a standalone HTML file (with canvas animations, vanilla JS only)
4. All 4 HTML files are composed into a 2x2 grid comparison video (1920x1080, 30fps, 30 seconds)
5. The pipeline is packaged as Claude Code skills for one-command re-use

### The Test Case
The specific prompt used for testing (identical to the original video):

> Create a single HTML file with a full-screen animated retro arcade space battle scene (NOT a playable game - a cinematic demo). Use only HTML, CSS, and vanilla JavaScript (no libraries). Show a pixel-art spaceship at the bottom firing lasers upward at waves of descending alien invaders. Aliens should explode in pixel bursts when hit. Include a scrolling starfield background, a classic green CRT scanline overlay effect, and a retro score counter ticking up. Some aliens should fire back. Use canvas. Make it feel like watching a perfect arcade run from the 1980s.

### The 4 Models
- **GLM-5** (by Zhipu AI, via OpenRouter)
- **MiniMax M2.5** (by MiniMax, via OpenRouter)
- **Gemini 3 Pro** (by Google, via OpenRouter)
- **Claude Opus 4.6** (by Anthropic, via OpenRouter)

---

## 3. Documents and References Read

During the planning and implementation phases, the following references were consulted:

### Source Video
- **EJAE YouTube video** — "How to Run OpenCode Inside an Autonomous Claude Code AI Agent" (https://www.youtube.com/watch?v=oG0jmaIlL1w). This was the primary reference for the entire workflow: the architecture, the tool chain, the creative prompt, the model selection, and the Remotion video rendering approach. A transcript of the video was used during planning to extract exact command syntax and authentication steps.

### Technical Documentation Consulted at Runtime
- **OpenCode CLI docs** (https://opencode.ai/docs/cli/) — Referenced to understand the `opencode run` command syntax, especially the `-m` (model) flag format `provider/model-name`.
- **OpenCode auth system** — The auth config file (`auth.json` in OpenCode's data directory) was read to understand how OpenCode stores provider credentials.
- **OpenCode models list** — The command `opencode models` was run to discover available model names under each provider prefix (`opencode/`, `openai/`, `openrouter/`).
- **Remotion documentation** — Used to set up the brownfield Remotion project with `IFrame`, `staticFile()`, `AbsoluteFill`, and `Composition` components.

### Previous Session Context
- The Claude Code planning session transcript was searched to understand how the original author configured OpenRouter authentication in OpenCode. This was critical when we hit the billing error (see Section 8).

---

## 4. Architecture Overview

```
User invokes Claude Code skill ("/llmbench")
  │
  ├── Claude Code spawns 4 parallel background processes:
  │     ├── opencode run -m openrouter/z-ai/glm-5 "prompt..."         → llmtest/game-glm5.html
  │     ├── opencode run -m openrouter/minimax/minimax-m2.5 "prompt..."→ llmtest/game-minimax25.html
  │     ├── opencode run -m openrouter/google/gemini-3-pro-preview ... → llmtest/game-gemini3pro.html
  │     └── opencode run -m openrouter/anthropic/claude-opus-4.6 ...   → llmtest/game-opus46.html
  │
  │   (Each opencode run is a full agentic session — it reads the prompt,
  │    generates code, writes the HTML file to disk, and exits)
  │
  ├── cp llmtest/game-*.html → remotion/public/
  │
  ├── npx remotion render index.ts GridComparison out/comparison.mp4
  │     --concurrency=1 --timeout=90000 --public-dir=remotion/public
  │
  └── out/comparison.mp4 (1920x1080, 30fps, 30s, 2x2 grid with model labels)
```

### Key Technical Decisions

1. **`--concurrency=1` for Remotion rendering**: The HTML files use `requestAnimationFrame` canvas animations. Remotion captures frames by running a headless Chromium browser, but it cannot sync with `requestAnimationFrame`-based animation loops. Using concurrency=1 means a single browser tab renders frames sequentially, allowing the canvas animations to naturally advance between frame captures. Higher concurrency would create multiple tabs, each starting animations from frame 0, producing broken output.

2. **`staticFile()` for HTML loading**: Remotion's `staticFile()` serves files from the `public/` directory. The HTML files must be copied there before rendering.

3. **`delayRenderTimeoutInMilliseconds: 60000`**: Complex HTML files with canvas animations need time to load. The 60-second timeout per IFrame prevents premature rendering failures.

4. **Brownfield Remotion setup**: Instead of using `create-video` (Remotion's scaffolding tool), we created a minimal Remotion project manually inside `remotion/`. This keeps the project contained and avoids polluting the root directory with Remotion boilerplate.

---

## 5. How 4 HTML Files Become a Video (The Remotion Pipeline)

This is the part that feels like magic if you haven't seen it before. You have 4 standalone HTML files sitting in a folder — each one a fully working animated space battle game running on a `<canvas>`. How does that become a 30-second MP4 video showing all 4 side by side? Here's exactly what happens, step by step.

### 5.1 What Is Remotion?

Remotion is a React-based framework for creating videos programmatically. Instead of editing video in Premiere or After Effects, you write React components that describe what each frame of the video looks like. Remotion then:

1. Spins up a **headless Chromium browser** (no visible window)
2. Renders your React component for frame 0, takes a screenshot (PNG)
3. Advances to frame 1, renders again, takes another screenshot
4. Repeats for every frame (in our case: 900 frames = 30 seconds at 30fps)
5. Stitches all 900 PNGs into an MP4 using ffmpeg (bundled with Remotion)

Think of it as an automated screen-recording robot that renders a webpage 900 times, takes a pixel-perfect screenshot each time, and assembles them into a video.

### 5.2 The File Flow

```
llmtest/game-glm5.html          ──┐
llmtest/game-minimax25.html      ──┤  cp *.html
llmtest/game-gemini3pro.html     ──┤  ────────→  remotion/public/game-*.html
llmtest/game-opus46.html         ──┘                     │
                                                         │  staticFile("game-glm5.html")
                                                         │  returns URL like
                                                         │  http://localhost:3000/game-glm5.html
                                                         ▼
                                               ┌─────────────────────┐
                                               │  GridComparison.tsx  │
                                               │                     │
                                               │  ┌───────┬───────┐  │
                                               │  │IFrame │IFrame │  │
                                               │  │GLM-5  │MiniMax│  │
                                               │  ├───────┼───────┤  │
                                               │  │IFrame │IFrame │  │
                                               │  │Gemini │Opus   │  │
                                               │  └───────┴───────┘  │
                                               └─────────────────────┘
                                                         │
                                                         │  Remotion renders this component
                                                         │  900 times (once per frame)
                                                         │  in a headless Chromium browser
                                                         ▼
                                               ┌─────────────────────┐
                                               │  Frame 0: screenshot │
                                               │  Frame 1: screenshot │
                                               │  Frame 2: screenshot │
                                               │  ...                 │
                                               │  Frame 899: screenshot│
                                               └─────────────────────┘
                                                         │
                                                         │  ffmpeg encodes PNGs → MP4
                                                         ▼
                                                  out/comparison.mp4
                                                  (32MB, 1920x1080, 30fps, 30s)
```

### 5.3 Why Copy to `remotion/public/`?

Remotion serves static files from a `public/` directory, just like a web server. When your React code calls `staticFile("game-glm5.html")`, Remotion translates that into a local URL like `http://localhost:3000/public/game-glm5.html`. The `<IFrame>` component then loads that URL.

If the HTML files aren't in `remotion/public/`, `staticFile()` can't find them and the IFrames render blank.

This is why the pipeline has a `cp llmtest/game-*.html remotion/public/` step — it's staging the model outputs where Remotion can serve them.

### 5.4 How Each File Plays Its Role

There are 5 files in `remotion/`. Here's what each one does and why:

#### `remotion/index.ts` — The Entry Point
```typescript
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
registerRoot(RemotionRoot);
```
This is what Remotion looks for when you run `npx remotion render index.ts ...`. It tells Remotion: "The root of this video project is the `RemotionRoot` component." Think of it like `index.html` for a website — it's the starting file that loads everything else.

#### `remotion/Root.tsx` — The Video Definition
```tsx
<Composition
  id="GridComparison"
  component={GridComparison}
  durationInFrames={900}
  fps={30}
  width={1920}
  height={1080}
/>
```
This registers a **Composition** — Remotion's term for "a video." It says:
- **id**: "GridComparison" — the name we use in the CLI command to select this video
- **component**: `GridComparison` — the React component that renders each frame
- **durationInFrames**: 900 frames total
- **fps**: 30 frames per second → 900/30 = **30 seconds** of video
- **width/height**: 1920x1080 pixels (standard Full HD)

You could register multiple compositions here (e.g., a 3x2 grid, a single-model view) and select which one to render via the CLI.

#### `remotion/GridComparison.tsx` — The Visual Layout (Most Important File)

This is the component that Remotion renders 900 times. It draws:

1. **A black background** (`AbsoluteFill` with `backgroundColor: "#000"`)

2. **Two thin gray divider lines** — one vertical (splitting left/right) and one horizontal (splitting top/bottom), creating the 2x2 grid appearance. Each divider is 2 pixels wide/tall, colored `#333`.

3. **Four `ModelCell` components**, arranged in a 2x2 grid:

```
┌──────────────────┬──────────────────┐
│                  │                  │
│   IFrame loads   │   IFrame loads   │
│   game-glm5.html │  game-minimax25  │
│                  │     .html        │
│  ┌────────────┐  │  ┌────────────┐  │
│  │  GLM-5     │  │  │ MiniMax M2.5│  │
│  └────────────┘  │  └────────────┘  │
├──────────────────┼──────────────────┤
│                  │                  │
│   IFrame loads   │   IFrame loads   │
│  game-gemini3pro │  game-opus46     │
│     .html        │     .html        │
│  ┌────────────┐  │  ┌────────────┐  │
│  │ Gemini 3 Pro│  │  │Claude Opus │  │
│  └────────────┘  │  └────────────┘  │
└──────────────────┴──────────────────┘
```

Each cell contains:
- An **`<IFrame>`** that loads one HTML file via `staticFile()`. The IFrame is sized to fill the cell minus a 36px label bar at the bottom.
- A **label bar** at the bottom: a dark semi-transparent strip (`rgba(0,0,0,0.85)`) with the model name in green monospace text (`#00ff88`, Courier New, 18px bold). This mimics a retro terminal aesthetic.

The `<IFrame>` component is Remotion's special iframe wrapper. It includes `delayRenderTimeoutInMilliseconds={60000}` which tells Remotion: "Wait up to 60 seconds for this iframe's content to load before giving up." This is necessary because the HTML files contain complex canvas code that may take a few seconds to initialize.

#### `remotion/package.json` — Dependencies
```json
{
  "dependencies": {
    "@remotion/cli": "4.0.261",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "4.0.261",
    "typescript": "^5.7.0"
  }
}
```
- **remotion** + **@remotion/cli**: The core framework and its CLI (which includes bundled Chromium and ffmpeg)
- **react** + **react-dom**: Required because Remotion components are React components
- **typescript**: For `.ts` and `.tsx` file compilation

When you run `npm install`, Remotion automatically downloads a headless Chromium binary (~150MB) and ffmpeg. This is why the first install takes a while, but subsequent renders are faster.

#### `remotion/tsconfig.json` — TypeScript Config
Sets `"jsx": "react-jsx"` so TypeScript understands `.tsx` files with JSX syntax like `<IFrame>`, `<AbsoluteFill>`, etc.

### 5.5 The Render Command Explained

```bash
npx remotion render index.ts GridComparison ../out/comparison.mp4 \
  --concurrency=1 \
  --timeout=90000 \
  --public-dir=public
```

Breaking this down argument by argument:

| Argument | Meaning |
|---|---|
| `npx remotion render` | Run Remotion's render command (npx runs it from node_modules) |
| `index.ts` | The entry point file (which calls `registerRoot`) |
| `GridComparison` | The Composition ID to render (matches `id="GridComparison"` in Root.tsx) |
| `../out/comparison.mp4` | Output file path (relative to the remotion/ working directory) |
| `--concurrency=1` | Use only 1 browser tab at a time for rendering (see 5.6 below) |
| `--timeout=90000` | Overall render timeout: 90 seconds max |
| `--public-dir=public` | Where to serve static files from (the HTML files live here) |

### 5.6 Why `--concurrency=1` Is Critical

This is the most important and non-obvious detail in the entire video pipeline.

**The problem**: The 4 HTML files use `requestAnimationFrame` and `<canvas>` for their animations. These animations run in **real time** — each call to `requestAnimationFrame` advances the animation by one browser frame (~16ms at 60fps).

**How Remotion normally renders**: With higher concurrency (e.g., `--concurrency=4`), Remotion opens 4 browser tabs simultaneously and renders frames in parallel across them. Tab 1 might render frames 0, 4, 8, 12... while Tab 2 renders 1, 5, 9, 13... This is great for static content or Remotion-native animations (which use Remotion's `useCurrentFrame()` hook).

**Why parallel rendering breaks our HTML files**: When a new tab opens and loads an HTML file, the canvas animation starts from the beginning (frame 0 of the game). If Remotion asks Tab 2 to render video frame 100, the game inside the iframe is actually at game frame 0 because the tab just opened. The canvas animation and Remotion's frame counter are **completely desynchronized**.

**How `--concurrency=1` fixes it**: With a single tab, Remotion loads the HTML files once. For each video frame, it takes a screenshot. Between frames, the browser's event loop ticks forward, which means `requestAnimationFrame` callbacks fire and the canvas animations advance naturally. Frame 0 of the video captures the game at game-time 0. Frame 30 captures game-time ~1 second. Frame 900 captures game-time ~30 seconds. The video frame counter and the game's internal animation stay **roughly synchronized** because they're running in the same browser tab continuously.

**The tradeoff**: Rendering is much slower with `--concurrency=1` (~2-3 minutes for 900 frames vs ~30 seconds with concurrency=4). But the output is correct — you see the games actually playing and progressing, not frozen at their start state.

### 5.7 What the Render Process Looks Like in Practice

When you run the render command, here's what you see in the terminal:

```
Bundling 0%
Bundling 15%
...
Bundling 100%
Getting compositions
Cached bundle. Subsequent renders will be faster.
Rendered 1/900, time remaining: 3m 15s
Rendered 2/900, time remaining: 3m 14s
...
Rendered 450/900, time remaining: 1m 30s
...
Rendered 900/900, time remaining: 0s
Stitched 100/900
Stitched 200/900
...
Stitched 900/900
+ ../out/comparison.mp4  32.8 MB
```

Three phases:
1. **Bundling** (~10 seconds): Remotion compiles the TypeScript/React code into a JavaScript bundle (like webpack). This bundle is what the headless browser loads.
2. **Rendering** (~2-3 minutes): The headless browser renders each frame and saves it as a PNG. This is the slow part because `--concurrency=1` means one frame at a time.
3. **Stitching** (~10 seconds): ffmpeg takes all 900 PNGs and encodes them into an H.264 MP4. This is fast because ffmpeg is highly optimized.

### 5.8 What the Final Video Looks Like

The output is a standard MP4 file (H.264 codec, 1920x1080, 30fps, 30 seconds). When you play it:

- The screen is divided into 4 quadrants by thin gray lines
- Each quadrant shows one model's space battle game running in real time
- At the bottom of each quadrant, a dark label bar shows the model name in green monospace text
- All 4 games play simultaneously, so you can visually compare:
  - How each model interpreted "pixel-art spaceship"
  - Quality of the starfield animation
  - How explosion effects differ
  - Whether the CRT scanline overlay was implemented
  - Overall visual polish and animation smoothness

### 5.9 Summary: The Video Pipeline in One Sentence

Remotion loads 4 HTML files into iframes inside a React component, opens a headless browser, takes 900 sequential screenshots (one per video frame) while the canvas animations play in real time, then stitches those screenshots into an MP4 with ffmpeg.

---

## 6. Step-by-Step Build Process

### Phase 1: Directory Structure and Configuration
1. Created `llmtest/` — where model HTML outputs are saved
2. Created `out/` — where the final MP4 video goes
3. Created `remotion/public/` — staging area for Remotion to access HTML files
4. Created `.claude/skills/llmbench/`
5. Updated `.gitignore` to exclude `.env`, `node_modules/`, `out/`, `llmtest/`, and `remotion/public/*.html`

### Phase 2: Skill Creation
1. **`.claude/skills/llmbench/SKILL.md`** — Full pipeline skill that includes the parallel model execution (Stage 1), copies HTML to Remotion (Stage 2), renders the video (Stage 3), and verifies the MP4 (Stage 4).

### Phase 3: Remotion Project
Created 5 files in `remotion/`:
1. **`package.json`** — Dependencies: remotion 4.0.261, @remotion/cli, react 18, react-dom, typescript
2. **`tsconfig.json`** — TypeScript config with `jsx: "react-jsx"` for JSX support
3. **`index.ts`** — Entry point that calls `registerRoot(RemotionRoot)`
4. **`Root.tsx`** — Registers the `GridComparison` composition: 1920x1080, 30fps, 900 frames (30s)
5. **`GridComparison.tsx`** — Core component: 2x2 grid layout with IFrame per cell, model label overlay (green monospace text on dark background), thin grid dividers

### Phase 4: Install Dependencies
```bash
cd remotion && npm install
```
Installed 181 packages including Remotion's bundled Chromium for headless rendering.

### Phase 5: Execute the Pipeline
1. Launched 4 parallel `opencode run` commands as background processes
2. Waited for all 4 HTML files to appear in `llmtest/`
3. Copied HTML files to `remotion/public/`
4. Ran `npx remotion render` to produce the MP4
5. Verified the output: `out/comparison.mp4` (32MB)

---

## 7. The Skills: What Was Built and How They Work

One Claude Code skill was created: **`/llmbench`** — the full end-to-end pipeline from prompt to video. It is **not** a traditional script or program — it is an **instruction document** (a Markdown file) that Claude Code reads and follows. When you invoke the skill, Claude Code loads the SKILL.md file, interprets the instructions, and executes the steps using its tools (Bash, Read, Write).

### 7.1 The Skill: `/llmbench` — Full Benchmark Pipeline (Prompt to Video)

| Skill | File | Invocation | What It Does |
|---|---|---|---|
| **llmbench** | `.claude/skills/llmbench/SKILL.md` | `/llmbench <prompt>` | Runs prompt across 4 models in parallel, then renders a 2x2 grid comparison video |

**Purpose**: The complete end-to-end pipeline. Send a prompt to 4 models, collect HTML outputs, and render them into a 2x2 grid comparison video. One command does everything.

**What happens when you invoke `/llmbench`**:

```
User types: /llmbench Create a single HTML file with a retro space battle...

Claude Code reads SKILL.md, then:

  ╔══════════════════════════════════════════════╗
  ║  STAGE 1: Parallel Model Execution            ║
  ╠══════════════════════════════════════════════╣
  ║  • Source .env                                ║
  ║  • Clean llmtest/                             ║
  ║  • Launch 4 parallel opencode run processes:  ║
  ║    ┌─ openrouter/z-ai/glm-5 → game-glm5.html ║
  ║    ├─ openrouter/minimax/minimax-m2.5         ║
  ║    │    → game-minimax25.html                 ║
  ║    ├─ openrouter/google/gemini-3-pro-preview  ║
  ║    │    → game-gemini3pro.html                ║
  ║    └─ openrouter/anthropic/claude-opus-4.6    ║
  ║         → game-opus46.html                    ║
  ║  • Wait for all to complete                   ║
  ║  • Verify 4 HTML files exist and are >1KB     ║
  ╚══════════════════════════════════════════════╝
            │
            ▼
  ╔══════════════════════════════════════════════╗
  ║  STAGE 2: Copy HTML to Remotion               ║
  ╠══════════════════════════════════════════════╣
  ║  cp llmtest/game-*.html remotion/public/      ║
  ╚══════════════════════════════════════════════╝
            │
            ▼
  ╔══════════════════════════════════════════════╗
  ║  STAGE 3: Render Video                        ║
  ╠══════════════════════════════════════════════╣
  ║  cd remotion && npx remotion render           ║
  ║    index.ts GridComparison                    ║
  ║    ../out/comparison.mp4                      ║
  ║    --concurrency=1 --timeout=90000            ║
  ║    --public-dir=public                        ║
  ║                                               ║
  ║  (Renders 900 frames → stitches into MP4)     ║
  ╚══════════════════════════════════════════════╝
            │
            ▼
  ╔══════════════════════════════════════════════╗
  ║  STAGE 4: Verify Output                       ║
  ╠══════════════════════════════════════════════╣
  ║  • Check out/comparison.mp4 exists            ║
  ║  • Report file size                           ║
  ║  • Report success/failure                     ║
  ╚══════════════════════════════════════════════╝
```

**Output**: `out/comparison.mp4` (a 1920x1080, 30fps, 30-second video showing all 4 model outputs in a 2x2 grid with model labels)

### 7.2 What a Claude Code Skill Actually Is

For readers unfamiliar with Claude Code skills: a skill is **not compiled code**. It's a Markdown file (`SKILL.md`) stored in `.claude/skills/<name>/`. When you type `/<skill-name>` in Claude Code, it reads the Markdown file and treats the contents as instructions for how to accomplish the task.

The SKILL.md file contains:
- **Frontmatter** (YAML header): name, description, what arguments it accepts, which tools Claude Code is allowed to use (Bash, Read, Write)
- **Instructions**: Step-by-step descriptions of what to do, including bash commands to run, files to check, and what to report back

Claude Code interprets these instructions using its own reasoning — it's not blindly executing a script. If a step fails, Claude Code can read the error, diagnose the problem, and adapt. This is why skills are more resilient than bash scripts: the AI agent provides the error-handling intelligence.

### 7.3 The Remotion Project Is Not a Skill

An important distinction: the Remotion project (`remotion/` directory with its 5 TypeScript/React files) is **not** a skill. It's a standalone video rendering project that the `/llmbench` skill calls into during Stage 3. The skill tells Claude Code to run `npx remotion render ...` — Remotion itself is a normal npm project with no awareness of Claude Code or skills.

```
Skill (instructions for Claude Code):
  └── .claude/skills/llmbench/SKILL.md

Infrastructure (code that the skill invokes):
  └── remotion/          ← normal npm project, not a skill
      ├── index.ts
      ├── Root.tsx
      ├── GridComparison.tsx
      ├── package.json
      └── tsconfig.json
```

---

## 8. Problems Encountered and Solutions

### Problem 1: OpenCode Zen Billing Error (CRITICAL)

**What happened**: The first attempt to run all 4 models used the `opencode/` model prefix (e.g., `opencode/glm-5`). All 4 failed immediately with:

```
Error: No payment method. Add a payment method here:
https://opencode.ai/workspace/wrk_01K6KMRWRSFY58Y3PCGMRJG2CZ/billing
```

**Root cause**: The `opencode/` model prefix routes through **OpenCode's own "Zen" API**, which is a separate paid service from OpenRouter. Even though the user had $4.74 credit on OpenRouter, the `opencode/` prefix doesn't use OpenRouter — it uses OpenCode's own billing system, which had no payment method configured.

**Why this was confusing**: In the original video, the host used the `opencode/` prefix successfully. This is because the host had already configured OpenRouter as a provider inside OpenCode via the TUI `/connect` command. When OpenRouter is connected as a provider, OpenCode can route `opencode/`-prefixed model requests through OpenRouter's API using the user's OpenRouter credit. However, the exact internal routing mechanism is opaque — it's not obvious from the outside whether `opencode/glm-5` is hitting OpenCode Zen or being proxied through OpenRouter.

**Solution**: We switched to using the `openrouter/` model prefix directly (e.g., `openrouter/z-ai/glm-5`), which explicitly routes through the user's OpenRouter account and credit. This required:
1. Adding OpenRouter as a provider in OpenCode's auth config
2. Discovering the correct OpenRouter model IDs (different from OpenCode Zen model names)
3. Updating both skills with the new model IDs

### Problem 2: Connecting OpenRouter to OpenCode

**What happened**: To use the `openrouter/` model prefix, OpenCode needs to know the user's OpenRouter API key. The standard method is to run the OpenCode TUI and use the `/connect` command to add OpenRouter as a provider.

**Attempt 1 — TUI `/connect` via separate terminal**: The user opened OpenCode's TUI in PowerShell and ran `/connect`, selected OpenRouter, and was prompted to paste the API key. However, **the TUI could not accept pasted input** via right-click (no paste option appeared in either Git Bash or PowerShell).

**Attempt 2 — Keyboard paste shortcut**: Using `Ctrl+Shift+V` in PowerShell worked to paste the key into the TUI input field. However, the user accidentally also pasted the key into our Claude Code chat session, exposing it. The key had to be revoked and rotated on the OpenRouter dashboard.

**Why TUI pasting is difficult on Windows**: OpenCode's TUI is a terminal-based user interface (likely built with Ink/React for terminals or a similar framework) that captures mouse and keyboard events. Standard Windows right-click paste is intercepted by the TUI's event handling. `Ctrl+V` may also be captured. Only `Ctrl+Shift+V` (Windows Terminal's paste shortcut) or `Shift+Insert` (universal terminal paste) typically work inside TUI applications.

**Final solution — Direct auth.json editing**: Instead of fighting with the TUI, we edited OpenCode's auth config file directly:

**File location**: `~/.local/share/opencode/auth.json`
- On Windows: `%USERPROFILE%\.local\share\opencode\auth.json`
- On macOS/Linux: `~/.local/share/opencode/auth.json`

**Before** (only OpenCode Zen configured):
```json
{
  "opencode": {
    "type": "api",
    "key": "<your-opencode-zen-key>"
  }
}
```

**After** (OpenRouter added):
```json
{
  "opencode": {
    "type": "api",
    "key": "<your-opencode-zen-key>"
  },
  "openrouter": {
    "type": "api",
    "key": "<your-openrouter-api-key>"
  }
}
```

**Why this worked**: OpenCode reads `auth.json` at startup. Each top-level key is a provider name. Adding `"openrouter"` with `"type": "api"` and the API key is exactly what the `/connect` TUI command does under the hood — it writes this same JSON structure. After this change, `opencode auth ls` confirmed both providers were recognized, and `opencode models openrouter` returned all available OpenRouter models.

### Problem 3: Model Name Mapping

**What happened**: The model names differ between OpenCode Zen and OpenRouter:

| OpenCode Zen name | OpenRouter name |
|---|---|
| `opencode/glm-5` | `openrouter/z-ai/glm-5` |
| `opencode/minimax-m2.5` | `openrouter/minimax/minimax-m2.5` |
| `opencode/gemini-3-pro` | `openrouter/google/gemini-3-pro-preview` |
| `opencode/claude-opus-4-6` | `openrouter/anthropic/claude-opus-4.6` |

Note the differences: OpenRouter uses the actual provider organization as a namespace (e.g., `z-ai/`, `google/`, `anthropic/`), and some model names differ slightly (e.g., `gemini-3-pro` vs `gemini-3-pro-preview`, `claude-opus-4-6` vs `claude-opus-4.6`).

**Solution**: Ran `opencode models openrouter` and grepped for each model family to find the exact IDs. Updated both skills with the correct names.

### Problem 4: API Key Security Incident

**What happened**: During the TUI pasting attempt, the user accidentally pasted their OpenRouter API key into the Claude Code chat session. This exposed the key in the conversation history.

**Resolution**:
1. The exposed key was immediately revoked on the OpenRouter dashboard
2. A new key was generated
3. The new key was saved to a local file (in a gitignored directory) instead of being typed in chat
4. Claude Code read the key from the file and wrote it to the auth.json
5. The key file directory is in `.gitignore` to prevent accidental commits

**Lesson for future users**: Never paste API keys directly into AI chat sessions. Always save keys to a local file and have the tool read from the file.

---

## 9. Why Claude Code Runs OpenCode (Not the Other Way Around)

### What the Original Video Demonstrated

The host used Claude Code as the **orchestrator** and OpenCode as a **subprocess**. This is counterintuitive — why not just use OpenCode directly? Or why not use Claude Code for everything?

### Why Not Just Do Everything in OpenCode?

This is the most natural question. OpenCode already has multi-model access via OpenRouter. It can write files. It has a CLI mode. Why bring Claude Code into the picture at all?

**What OpenCode can do well:**
- Run any LLM model via OpenRouter (its core strength — 100+ models)
- Execute a single prompt and have the model write output files
- Has a CLI mode (`opencode run -m model "prompt"`) perfect for scripting

**What OpenCode cannot do (or does poorly):**

1. **Orchestrate parallel runs of itself.** OpenCode is a single-session tool. Each `opencode run` command is one model, one prompt, one session. To run 4 models in parallel, you need to spawn 4 separate `opencode run` processes as background jobs, then `wait` for all of them, then check which succeeded and which failed. OpenCode has no built-in way to do this — it doesn't know about its own other instances. You need an external orchestrator to manage the parallel processes.

2. **Chain multi-stage pipelines with conditional logic.** Our workflow has 4 stages: run models → verify HTML outputs exist and are valid → copy files to Remotion → render video → verify MP4 exists. Between each stage, there's a decision point: "Did the previous stage succeed? If not, which model failed? Should I retry?" OpenCode's `run` mode is fire-and-forget — it executes a single prompt and exits. It can't inspect the results of a previous `opencode run` and decide what to do next.

3. **Build infrastructure (Remotion project, npm packages, TypeScript config).** OpenCode could theoretically be prompted to "create a Remotion project with these 5 files," but this requires a single mega-prompt that specifies all files, all dependencies, all configuration — and hopes the model gets it right in one shot. Claude Code, by contrast, can create files iteratively, run `npm install`, check for errors, fix them, and proceed. It has persistent filesystem awareness across the entire session.

4. **Create and manage Claude Code skills.** The entire point of packaging this as the `/llmbench` skill is so future runs are one-command operations inside Claude Code. OpenCode has no concept of Claude Code skills.

5. **Handle errors adaptively.** When our first attempt failed with the OpenCode Zen billing error, Claude Code could read the error, reason about the cause, search the session transcript for how auth was configured, propose a fix (switch to `openrouter/` prefix), update the skills, and retry — all within the same conversation. OpenCode would just fail and exit.

**In short: OpenCode is a model runner, not an orchestrator.** It's excellent at "take this prompt, send it to this model, save the output." It's not designed for "run 4 things in parallel, check results, copy files, run a different tool, verify the output, and report back."

### Why Not Just Do Everything in Claude Code?

**Yes, but at much higher cost and with a critical limitation.** Claude Code (powered by Claude) can generate HTML files directly without OpenCode. However:

- **Single-model limitation**: Claude Code can only call Claude models (via Anthropic's API). It cannot natively call GLM-5, MiniMax, Gemini, or any non-Anthropic model. The entire point of this benchmark is comparing **different models' creative output** — Claude Code alone cannot do this.
- **Cost**: Claude Code uses Anthropic's API pricing. Generating 4 large HTML files (12-28KB each) via Claude Opus would cost significantly more than routing through OpenRouter, where you can choose cheaper models and benefit from OpenRouter's pricing.
- **No model diversity**: You'd end up comparing "Claude with prompt variant A" vs "Claude with prompt variant B" — not "GLM-5 vs MiniMax vs Gemini vs Claude."

### Could You Script This Without Either AI Agent?

**Yes, with a plain bash script.** You could write:

```bash
#!/bin/bash
# Hypothetical non-agentic approach
opencode run -m openrouter/z-ai/glm-5 "prompt... Save as llmtest/game-glm5.html" &
opencode run -m openrouter/minimax/minimax-m2.5 "prompt... Save as llmtest/game-minimax25.html" &
# ... etc
wait
cp llmtest/*.html remotion/public/
cd remotion && npx remotion render index.ts GridComparison ../out/comparison.mp4 --concurrency=1
```

This would work — but only after someone has already:
1. Written and debugged the Remotion project (5 TypeScript/React files)
2. Figured out the correct OpenRouter model IDs
3. Configured OpenCode authentication
4. Tested that the prompt produces valid HTML from each model
5. Handled edge cases (model timeout, broken HTML, missing files)

Claude Code did all of this setup work in a single session. The bash script is the end product, but the intelligence was in building and debugging everything that makes the script work.

### The Sweet Spot: Claude Code as Orchestrator, OpenCode as Model Runner

| Capability | Claude Code | OpenCode | Bash Script |
|---|---|---|---|
| Multi-model access via OpenRouter | No (Claude only) | Yes (any model) | Yes (via opencode) |
| Parallel process management | Yes (background bash) | No (single session) | Yes (& and wait) |
| File system orchestration | Yes (read/write/edit) | Limited | Yes (cp, mv) |
| Multi-stage pipeline with reasoning | Yes (agentic) | No (single prompt) | No (linear only) |
| Error handling and adaptation | Yes (reads errors, reasons, fixes) | No | No (fails or continues) |
| Remotion/npm project creation | Yes (full dev tooling) | Possible but fragile | No |
| Create reusable skills | Yes (writes SKILL.md) | No | No |
| Cost for model inference | High (Anthropic API) | Low (OpenRouter) | Low (via opencode) |

**The architecture leverages each tool's strength**: Claude Code handles orchestration, file management, error recovery, and complex multi-step reasoning. OpenCode handles cheap, multi-model inference via OpenRouter. The resulting skills encode this division of labor so future runs are automated.

---

## 10. Pros and Cons of This Architecture

### Pros

1. **Multi-model comparison**: Access to 100+ models via OpenRouter at competitive pricing. You can benchmark any model against any other with a single prompt change.

2. **True parallelism**: All 4 models run simultaneously as background processes. Total time is ~max(individual times), not the sum. Our test completed all 4 models in about 90 seconds.

3. **Cost efficiency**: OpenRouter credit is typically much cheaper than calling each provider's API directly. The user had $4.74 and ran 4 models generating 12-28KB HTML files each with plenty of credit remaining.

4. **Reusable skill**: The `/llmbench` skill can be invoked with any prompt and any model list. Future benchmarks are one-command operations.

5. **Automated video output**: Remotion handles the visual comparison automatically. No manual screenshot or screen recording needed.

6. **Reproducibility**: Every step is scripted. New users can replicate the exact setup by following this guide.

7. **Extensibility**: Easy to add more models, change the grid layout, or modify the video format.

### Cons

1. **Complex dependency chain**: Requires Node.js, npm, OpenCode CLI, OpenRouter account, and Remotion — each with its own setup, versioning, and potential breakage points.

2. **Authentication complexity**: Three separate auth systems interact:
   - Claude Code's own auth (Anthropic API)
   - OpenCode's auth config (`auth.json` with provider keys)
   - OpenRouter's API key management

   Understanding which key goes where and which provider prefix to use is confusing (see Problem 1 above).

3. **Windows-specific friction**: The TUI pasting issue is Windows-specific. On macOS, `Cmd+V` typically works in terminal TUIs. Windows terminals handle paste differently depending on the terminal emulator (PowerShell, Git Bash, Windows Terminal, ConEmu, etc.).

4. **Opaque routing**: It's not always clear whether an `opencode/` prefixed model routes through OpenCode Zen (requires OpenCode billing) or through your connected OpenRouter account. The error messages don't always distinguish between "you need to pay OpenCode" and "your OpenRouter key is invalid."

5. **Remotion rendering is slow**: Rendering 900 frames at `--concurrency=1` takes 2-3 minutes. This is inherent to the requirement of sequential rendering for `requestAnimationFrame`-based animations.

6. **No live preview during model runs**: When OpenCode runs in the background, you only see the final HTML output. If a model produces broken HTML, you don't know until all 4 finish and you check the files.

7. **Fragile prompt engineering**: The prompt must instruct each model to "Save the complete file as llmtest/game-{model}.html". If a model ignores this instruction or saves to a different path, the pipeline breaks silently.

8. **Cost unpredictability**: Different models have different pricing on OpenRouter. Running Claude Opus 4.6 costs significantly more per token than GLM-5 or MiniMax. A complex prompt could exhaust credit faster than expected.

---

## 11. File Inventory

```
claude_code_runs_open_code_allaboutai/
├── .claude/
│   └── skills/
│       └── llmbench/
│           └── SKILL.md              # Full pipeline skill (prompt → models → video)
├── remotion/
│   ├── package.json                  # Remotion + React dependencies
│   ├── tsconfig.json                 # TypeScript config
│   ├── index.ts                      # Entry point (registerRoot)
│   ├── Root.tsx                      # Composition registration (1920x1080, 30fps, 900 frames)
│   ├── GridComparison.tsx            # 2x2 grid component with IFrames + labels
│   ├── node_modules/                 # Installed dependencies (181 packages)
│   └── public/                       # HTML files copied here for Remotion
│       ├── game-glm5.html
│       ├── game-minimax25.html
│       ├── game-gemini3pro.html
│       └── game-opus46.html
├── llmtest/                          # Raw model output
│   ├── game-glm5.html        (12KB)
│   ├── game-minimax25.html   (15KB)
│   ├── game-gemini3pro.html  (14KB)
│   └── game-opus46.html      (28KB)
├── out/
│   └── comparison.mp4         (32MB) # Final rendered video
├── HOW_IT_WORKS.md                   # This document
├── .ignore/                          # Gitignored directory for sensitive files (API keys, etc.)
└── .gitignore                        # Excludes .env, node_modules, out, llmtest, etc.
```

### External Files Modified
- **`~/.local/share/opencode/auth.json`** — OpenCode's auth config. We added the `"openrouter"` provider entry with the user's API key. See Section 7, Problem 2 for details.

---

## 12. How to Reproduce From Scratch

### Prerequisites
| Tool | Version Used | Install |
|---|---|---|
| Node.js | v22.22.0 | https://nodejs.org |
| npm | 9.9.4 | Comes with Node.js |
| OpenCode CLI | 1.1.28 | `npm i -g opencode` |
| OpenRouter account | — | https://openrouter.ai (need API key + credit) |

### Step-by-Step

```bash
# 1. Clone or create the project directory
mkdir llm-benchmark && cd llm-benchmark

# 2. Create directory structure
mkdir -p llmtest out remotion/public .claude/skills/llmbench

# 3. Configure OpenRouter in OpenCode
# Option A: Use the TUI (may have pasting issues on Windows)
opencode  # then /connect -> OpenRouter -> paste key

# Option B: Edit auth.json directly (RECOMMENDED on Windows)
# Find/create: ~/.local/share/opencode/auth.json
# Add the openrouter entry with your API key (see Section 8, Problem 2)

# 4. Verify OpenRouter is connected
opencode auth ls          # Should show "OpenRouter  api"
opencode models openrouter | head  # Should list models

# 5. Create Remotion project files
# (Copy the 5 files from the remotion/ directory described in Section 5, Phase 3)

# 6. Install Remotion dependencies
cd remotion && npm install && cd ..

# 7. Create the skill files
# (Copy SKILL.md into .claude/skills/llmbench/)

# 8. Run the benchmark (from Claude Code)
# Use /llmbench with your prompt
# Or run manually:
opencode run -m openrouter/z-ai/glm-5 "Your prompt... Save as llmtest/game-glm5.html" &
opencode run -m openrouter/minimax/minimax-m2.5 "Your prompt... Save as llmtest/game-minimax25.html" &
opencode run -m openrouter/google/gemini-3-pro-preview "Your prompt... Save as llmtest/game-gemini3pro.html" &
opencode run -m openrouter/anthropic/claude-opus-4.6 "Your prompt... Save as llmtest/game-opus46.html" &
wait

# 9. Copy to Remotion and render
cp llmtest/game-*.html remotion/public/
cd remotion && npx remotion render index.ts GridComparison ../out/comparison.mp4 \
  --concurrency=1 --timeout=90000 --public-dir=public

# 10. Check output
ls -lh out/comparison.mp4
```

---

## 13. Cost Analysis

For the benchmark test (4 models, ~12-28KB HTML output each):

| Model | Provider | Approx Cost |
|---|---|---|
| GLM-5 | Zhipu AI via OpenRouter | ~$0.05-0.10 |
| MiniMax M2.5 | MiniMax via OpenRouter | ~$0.05-0.10 |
| Gemini 3 Pro | Google via OpenRouter | ~$0.10-0.20 |
| Claude Opus 4.6 | Anthropic via OpenRouter | ~$0.30-0.60 |
| **Total** | | **~$0.50-1.00** |

The user had $4.74 in OpenRouter credit, which is enough for approximately 5-10 full benchmark runs with this model set. Cheaper models (GLM, MiniMax) can be tested many more times.

Note: These are rough estimates. Actual costs depend on prompt length, output length, and current OpenRouter pricing.

---

## 14. Future Work

Based on the original vision and natural extensions:

1. **Auto-post to X/Twitter**: The original workflow included posting the comparison video to X. This could be added as a Stage 5 in the llmbench skill using the `gh` CLI or X API.

2. **More models**: OpenRouter has 100+ models. The skills can be easily modified to test 6, 8, or more models with different grid layouts (3x2, 4x2, etc.).

3. **Automated scoring**: Add an LLM-as-judge stage where a model reviews all 4 HTML files and scores them on criteria like visual quality, code correctness, animation smoothness, etc.

4. **Prompt library**: Build a collection of standardized creative prompts for consistent benchmarking across model releases.

5. **Scheduled runs**: When a new model drops on OpenRouter, automatically run the benchmark suite and publish results.

6. **Cost tracking**: Integrate OpenRouter's usage API to track and report exact costs per benchmark run.

---

## Appendix: Key Config File Locations

| File | Path | Purpose |
|---|---|---|
| OpenCode auth | `~/.local/share/opencode/auth.json` | Provider API keys |
| OpenCode binary | `~/.opencode/bin/opencode` | CLI executable |
| Claude Code skills | `<project>/.claude/skills/<name>/SKILL.md` | Reusable skill definitions |
| Remotion project | `<project>/remotion/` | Video rendering engine |
| Model outputs | `<project>/llmtest/` | Generated HTML files |
| Video output | `<project>/out/` | Rendered MP4 |

**Note**: `~` refers to the user's home directory (`$HOME` on macOS/Linux, `%USERPROFILE%` on Windows).
