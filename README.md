# FORM

**Better habits. Sharper you.**

A personal presentation assistant. You take one photo; FORM tells you what
already works, and gives you a short list of things worth trying — all of them
under your control.

It does not score you.

---

## What it refuses to do

This is the part that shapes everything else, so it goes first.

| | |
|---|---|
| **No score, ever** | No rating, ranking, percentile or "better than X% of people". The prioritisation maths exists, but it is computed, sorted on and discarded — what reaches the screen is *High impact* / *Easy* / *Medium confidence*. A test asserts no score-shaped field or phrase can escape. |
| **No diagnosis** | No condition is ever named. A test greps the entire rule catalogue for dermatological, endocrine and pharmaceutical vocabulary and fails on a match. Anything that could warrant a professional says so neutrally and says nothing more. |
| **No ideal to measure against** | No golden ratio, no "correct" proportions, no comparison to a face that isn't yours. Face shape is used the way a barber uses it — to choose a framing — never as a standard to fall short of. |
| **No obsessive loop** | Progress counts what you explored, not how you improved. There is no trend line of your face, and the app actively suggests waiting weeks between reads. |

## How it works

```
photo ─► quality gate ─► measurement ─► confidence cap
                                             │
             observed ──► inferred ──► recommended ──► prioritised
              (what the    (what it      (what you      (order only)
               image        might mean    could try)
               shows)       for framing)
```

Two properties are enforced in code rather than by convention:

**Photo quality caps confidence.** A rule cannot claim high confidence from a
dark, angled frame — the cap is applied after the rule runs and the rule has no
way to override it. A bad photo produces general suggestions that say so, not
confident findings nobody can verify.

**Observation, inference and recommendation are different types.** There is no
code path from a measurement to advice that skips the hedged middle step,
because the three are separate shapes in the type system.

### The measurement

The horizontal iris is about 11.7 mm in adults with very little variation, which
makes it a physical ruler that happens to be inside every photograph. Scaling by
it turns pixels into millimetres, so "your cheekbone width is 142 mm" is a real
number you can take to an optician — rather than a ratio with no units.

Capture runs a live loop and fuses twelve gate-passing frames with a median. One
frame is not a measurement; landmark output jitters, and a single shot gives a
different answer every time you press the button.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm run verify       # typecheck + tests + production build
```

Camera access needs HTTPS. `localhost` counts as secure; production needs a real
certificate, which Vercel provides.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Motion · MediaPipe
Tasks Vision · Supabase · Vercel.

Detection runs as WASM in the browser. There is no inference server, no API key
and no per-request cost — and no frame ever leaves the device.

## Tests

| | |
|---|---|
| `npm test` | 17 assertions, most of them safety: no score can escape, no medical vocabulary in the catalogue, confidence is capped by quality, every recommendation traces to an observation, every card answers what/why/how. |
| `bash test/rls.sh` | Applies the schema to a real PostgreSQL and proves the row-level-security policies isolate users. The anon key is public by design, so RLS is the only thing making that safe. |
| `node test/visual.mjs` | Boots the production build, walks every screen at 320/390/1280, fails on a console error or horizontal overflow. |

## Data

Nothing leaves the device unless you create an account, and even then only
numbers do. The `analyses` table has no column capable of holding an image —
the privacy promise is structural rather than a policy note.

Schema and row-level-security policies: [`supabase/migrations`](supabase/migrations).

## Structure

```
src/
  app/                  routes: welcome · onboarding · scan · results · plan · progress
  components/           Shell, CaptureStage, AnalysisSequence, RecommendationCard
  components/ui/        Button, Card, Label, Indicator
  lib/vision/           geometry · landmarks · faceMeasure · skinRead · detector
  lib/analysis/         types (the safety contract) · quality · pipeline
  content/rules.ts      every observation, inference and recommendation
  hooks/useCapture.ts   the live capture loop
supabase/migrations/    schema + RLS
test/                   safety · rls · visual
```

## Known limits

- **The hairline is approximated.** FaceMesh has no trichion landmark; the top of
  the detected oval stands in. Anything derived from it is treated as
  approximate and never presented as a proportion standard.
- **Single-camera depth.** Everything is measured in the image plane. Head turn
  beyond the gate is rejected rather than corrected — a projective correction
  from one view would add more error than it removes.
- **Skin readings describe the photograph.** Lighting and texture are not
  separable from a single frame, which is why those rules carry low confidence
  and point to habits rather than conclusions.

## Licence

MIT
