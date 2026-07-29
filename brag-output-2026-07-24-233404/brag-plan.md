# Brag Plan: Impulse IDE

## What is this app?
Impulse is an agentic desktop IDE for Arduino / IoT. The AI agent writes code, installs libraries, compiles, uploads to the board, reads serial output, and verifies the sketch actually runs on hardware — closing the entire hardware loop instead of pasting code and stopping.

## The angle
Every other AI coding tool gives you a code block and walks away. On hardware, that leaves you with 90% of the work — install the library, get the FQBN right, flash the board, open the serial monitor, decode what came back. Impulse is the first agent that actually *touches the physical board*. The video's premise: watch a prompt turn into blinking LEDs and serial output — no human clicks in between.

## Hook (first 2-3 seconds)
Black screen. Signal-orange Impulse mark. Below it, one line typed live in mono: `"blink an LED on GPIO 2"`. Cursor blinks. Then — cut to code streaming in.

## Key moments (the middle)
- Agent writes the `.ino` sketch in the editor — code streams in line by line in the SB2 mono editor.
- Compile → Install library → Upload — three status chips flip from grey to green in a tight sequence. The upload chip shows `Uploading to COM3…` then flips.
- Serial monitor pops up. Actual sensor-looking output types in: `MPU6050 OK` then `ax=0.02 ay=-0.01 az=0.98`. A green checkmark: `Verified ✓`.

## Outro / punchline
Cut to product wordmark on the bone-white paper background. Tagline underneath: `The AI that touches the board.` Then: `github.com/nate1029/Impulse`.

## User flow worth showing
User types a prompt in the agent panel → agent writes sketch + auto-installs missing library + compiles → uploads to real board → connects to serial → verifies expected string appears → reports success. This is the actual moat, and it's what the whole video is built around.

## Tone
- Preset: `polished`
- Creative direction: Restrained hardware-engineering tool film. Bauhaus-adjacent. Signal-orange used surgically, never as decoration. The vibe of a Teenage Engineering product page crossed with a Vercel launch.
- Interpretation: Fewer scenes, longer holds, confident spacing. Motion is springy-mechanical (the SB2 easing), never bouncy. No emojis, no gimmicks. The tool speaks for itself.

## Format: landscape — 1920x1080
## Duration: 20 seconds

## Visual identity (from the project)
- Background: `#131211` (warm carbon, dark theme)
- Accent: `#EA4A0F` (persimmon signal-orange)
- Text: `#efeae0` (bone)
- Display font: BB Manual Mono Pro (mono, chrome) — fallback: JetBrains Mono
- Body font: Inter
- Strongest visual element: the editor + agent panel + serial monitor triad, in SB2 with soft offset block shadows and 8px radii. The lightning-bolt / waveform Impulse mark.

## Share copy (draft)
Built Impulse — the first AI agent that actually flashes your Arduino board and reads back the serial to prove it works. No more copy-paste-fail loops. → github.com/nate1029/Impulse

## Audio direction
- Role: sparse professional accents over a low warm bed
- Music: warm cinematic-tech bed (Hyperframes bundled if available; else muted swell)
- Music treatment: fade in at 0.5s, hold under −18dB, swell subtly at the verified moment (~sec 14), fade out at 19s
- Music cue guidance: pick a bundled `polished` / `cinematic-tech` bed; target one strong cue at the verify moment; sequential status-chip flips align to beat grid if bpm ≥ 100
- Audio-reactive treatment: subtle — the accent glow on the checkmark chip may respond to bass swell; nothing else
- SFX posture: sparse; motion-matched. One tick per key on the typed prompt; one soft click per status-chip flip; one confident "confirm" tone on `Verified ✓`
- Audio-coupled moments: typed prompt, code streaming, three status chips (compile/install/upload), serial lines typing, verify chime
- Restraint rule: no whooshes, no risers, no ta-da. The agent is a professional tool, not a hype reel.

## Storyboard

### Scene 1 — Hook: the prompt — 3.5s
Dark carbon background. Impulse wordmark small, top-center, in bone. Below: a single-line text input styled like the agent panel. Cursor blinks. Text types out: `blink an LED on GPIO 2` (18 chars, ~1.4s type + 1s hold).
Sequential/interaction: yes — the prompt is typed character by character to simulate the user issuing the request.
Audio intent: quiet key ticks, one per character. Music bed already faded in low.
Audio-coupled idea: typed text with subtle mechanical key ticks.
Music: low warm bed, barely present.
Transition mood: hard cut → Scene 2

### Scene 2 — Code writes itself — 4.5s
Full-bleed editor mockup (SB2 chrome — file tab reading `blink.ino`, line gutter, mono font). Sketch code streams in from top to bottom: `void setup() { pinMode(2, OUTPUT); } void loop() { digitalWrite(2, HIGH); delay(500); digitalWrite(2, LOW); delay(500); }`. Streaming completes at ~3.5s. Hold on final code for 1s.
Sequential/interaction: yes — code appears line by line as if the agent is writing it.
Audio intent: rapid soft typing texture under, not per-character.
Audio-coupled idea: line-by-line code reveal with a soft granular typing bed.
Music: bed continues, still low.
Transition mood: clean crossfade → Scene 3

### Scene 3 — Build pipeline — 4s
Editor scales down to left half. Right half shows three status chips stacked vertically in SB2 style (rounded, offset block shadow):
1. `COMPILE` — flips grey → green with `✓ 24kb / 32kb` in 0.6s
2. `INSTALL LIBRARY  Adafruit_MPU6050` — flips grey → green in 0.6s (arrives ~0.4s after chip 1)
3. `UPLOAD  COM3` — shows `Uploading…` with progress bar 0→100%, then flips green in 1.2s
Total chip sequence lands at ~3.5s. Hold at 4s.
Sequential/interaction: yes — three chips arrive one by one, each with a distinct sound.
Audio intent: soft mechanical click per chip flip. Upload progress under a subtle whir texture (not a whoosh).
Audio-coupled idea: chip flips beat-aligned if bpm allows.
Music: bed continues, small rise into the third chip.
Transition mood: hard cut → Scene 4

### Scene 4 — Serial verification (the payoff) — 5s
Full-bleed dark serial-monitor mockup (SB2 chrome: header reading `Serial Monitor · COM3 · 115200 baud`). Lines type in over 3s:
```
MPU6050 OK
ax=0.02 ay=-0.01 az=0.98
ax=0.01 ay=-0.02 az=0.99
ax=0.03 ay=-0.01 az=0.98
```
Then a persimmon `Verified ✓` chip slams in bottom-right at ~sec 3.5 and holds. Hold on this frame for 1.5s.
Sequential/interaction: yes — serial lines appear one at a time as if the board is streaming them live.
Audio intent: soft terminal ticks per line. Confident single-note confirmation chime on `Verified ✓`. Music swells subtly here.
Audio-coupled idea: streaming serial lines, verify chime beat-matched.
Music: subtle swell at verify moment.
Transition mood: soft crossfade → Scene 5

### Scene 5 — Wordmark & CTA — 3s
Cut to bone-paper background (light theme reveal — the palette flip is the whole moment). Center: Impulse waveform mark in persimmon. Below in Inter Medium, spaced: `The AI that touches the board.` Below that in mono, small: `github.com/nate1029/Impulse`. Hold.
Sequential/interaction: none — one confident hold.
Audio intent: music bed peaks softly and fades. No SFX.
Audio-coupled idea: none.
Transition mood: none — end frame.

**Total: 3.5 + 4.5 + 4 + 5 + 3 = 20s ✓**

**Music mood for this video:** warm, restrained, cinematic-tech — the vibe of a hardware-tool product film, not a hype reel.
**Audio summary:** Low warm bed throughout, key/click SFX motion-matched to typed prompt and status chips, single confident swell on Verified ✓, clean fade on wordmark. Nothing gratuitous.
