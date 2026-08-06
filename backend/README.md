# Lie-of-Omission Detector — Step 1: Core Reasoning Smoke Test

This is the very first slice of the project: no database, no API server, no
frontend — just proof that a **free** hosted vision model can correctly tell
the difference between "contradicted" and "missing evidence" for a compliance
claim. Everything else in the PDR gets built on top of this once it works.

## Cost

Everything here is free:
- **Groq** (primary) — free tier, no credit card, generous rate limits.
- **Ollama** (fallback, optional) — runs on your own machine, only used if Groq fails.

## Setup

1. **Get a free Groq API key** — sign up at https://console.groq.com and
   create a key at https://console.groq.com/keys. No credit card needed.

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure your key:**
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and paste your key into `GROQ_API_KEY=`.

4. **(Optional) Set up the local fallback:**
   Install [Ollama](https://ollama.com), then:
   ```bash
   ollama pull qwen2.5vl
   ollama pull llama3.1
   ```
   You can skip this — the smoke test works fine on Groq alone. It's only
   there so the pipeline doesn't hard-stop if Groq is ever rate-limited.

5. **Get a test image.** Any photo of a vehicle, or any object, works to
   start — a real photo of a car where one side/panel is out of frame is
   the most useful first test, since it directly exercises the
   "missing_expected_evidence" case the whole project is built around.

6. **Run the smoke test:**
   ```bash
   python scripts/test_vision.py path/to/your_test_image.jpg
   ```

## What "working" looks like

The script sends a fixed claim ("severe damage to the left rear door") along
with your image, and asks the model to describe what's visible, then judge
the claim. You should get back JSON like:

```json
{
  "description": "The image shows the front, hood, windshield, and right side of a vehicle...",
  "verdict": "missing_expected_evidence",
  "explanation": "The left rear door is not visible in the frame...",
  "confidence": "high"
}
```

If you upload a photo where the left rear door genuinely **is** visible and
damaged, you should get `"supported"`. If it's visible and undamaged, you
should get `"contradicted"`. If the verdict logic is unreliable on a handful
of test photos, that's the signal to iterate on the prompt (Section 6.4 of
the PDR) before building anything further.

## Project structure so far

```
core/
  config.py          # all provider settings — change providers here, not in code
models/
  model_client.py    # abstract interface every provider implements
  groq_client.py      # primary provider (hosted, free)
  ollama_client.py    # fallback provider (local, free)
  router.py           # tries primary, falls back automatically
scripts/
  test_vision.py       # Step 1 smoke test — run this first
```

## Next steps (once this works)

1. Build a small hand-built eval set (8-10 claim+image+correct-verdict
   examples) and run this same reasoning loop against all of them to check
   accuracy before writing more code.
2. Add `extract_claims.py` (turns raw document text into a claims list).
3. Add `contradiction_check.py` as its own module.
4. Only then: MongoDB, FastAPI, React frontend.
