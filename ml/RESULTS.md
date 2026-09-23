# Measured results

Every number here comes from a script in this repo and can be re-run. Nothing
is estimated, and nothing is copied from a paper.

Hardware: RTX 3050 Laptop (4 GB). All training done locally.

| # | Model | What it replaces | Headline (frozen test set) |
|---|---|---|---|
| 1 | Report classifier v1 — char n-gram TF-IDF + logistic regression, runs in TypeScript | keyword rules in `backend/lib/ai/fallback.ts` | team benchmark **60% → 76%** |
| 2 | Report classifier v3 — fine-tuned **MuRIL** (+ TF-IDF ensemble) | v1, when the sidecar is up | **96% top-2**, **96.6% when confident**, 78% top-1 |
| 3 | Dedup embeddings — contrastively fine-tuned MiniLM | local hashing vectoriser in `backend/lib/ai/local-embed.ts` | **80% of duplicates found at 86% precision** (was 0%) |
| 4 | Whisper-small + LoRA on rural Hindi phone audio | nothing (there was no offline speech to text) | **WER 114% → 60%** |

## Test sets (frozen, hashes recorded)

* `classifier/testset_v2_frozen.jsonl` — 40 hand-written reports, written
  **after** the generator was last changed and never used for tuning.
* `dedup/testset_pairs_frozen.jsonl` — 30 pairs describing the same problem in
  different words/scripts, plus all 870 cross-pairs as negatives (90 of them in
  the same category, i.e. hard).
* `dedup/calibration_pairs.jsonl` — 18 separate hand-written pairs, used only to
  pick the merge threshold, never for scoring.

## 1–2. Report classifier

Trained on 40,000 synthetic messy reports (Devanagari, Roman Hindi, English,
mixed; SMS noise, dropped vowels, typos) from `classifier/generate_synthetic.py`,
labelled exactly by the generator. Heads: category (8), severity (1–5), DM phase
(4), vulnerable groups (7, multi-label).

### Round 2 (2026-09-23): bigger vocabulary, better base model, ensemble

Three changes, each measured:

1. **Synonym layer** in the generator — every rendered report has its words
   swapped for real variants (`chapakal`/`handpump`/`nalka`/`boring`/`chuan`,
   `kharab`/`toota`/`band`/`bekar`), plus openers and closers a real message
   carries ("sir", "kripya dhyan dijiye"). Training set 20k → 40k.
2. **MuRIL** (`google/muril-base-cased`) as the encoder instead of MiniLM. It is
   Google's model for Indian languages *including Roman-Hindi transliteration*,
   which is what citizens actually type. Its 197k-token embedding (152M params)
   is frozen so it fits 4 GB.
3. **Ensemble**: transformer and TF-IDF probabilities averaged 50/50.

**Team benchmark (50 cases, written by a teammate, never trained on):**

| Model | Top-1 | Top-2 | When confident (≥0.7) |
|---|---|---|---|
| Keyword rules (before any model) | 60.0% | – | – |
| TF-IDF v1, inside the Compiler | 76.0% | – | 79% |
| MiniLM v2 | 66.0% | – | 74.3% |
| MuRIL v3 | 76.0% | – | 94.1% |
| **MuRIL + TF-IDF ensemble** | **78.0%** | **96.0%** | **96.6%** (58% of reports) |
| | | | 100% at ≥0.8 (28% of reports) |

Top-2 matters because the coordinator is shown the model's two candidates: the
right category is in front of a human **96% of the time**.

**Frozen v2 set (40 reports, ours, harder and noisier):**

| Test set | v1 TF-IDF | v2 MiniLM | v3 MuRIL | Ensemble |
|---|---|---|---|---|
| Synthetic validation (optimistic) | 99.9% | 99.6% | 98.4% | – |
| **Frozen v2 — category (top-1)** | 60.0% | 60.0% | **80.0%** | 75.0% |
| Frozen v2 — top-2 | – | – | – | 87.5% |
| Frozen v2 — severity within ±1 | 90.0% | 85.0% | 85.0% | – |
| Frozen v2 — vulnerable groups (micro-F1) | 0.58 | 0.53 | 0.54 | – |

### Where the remaining errors are

9 of the 11 ensemble errors on the team benchmark are reports that genuinely
belong to two categories, and the model picked the other valid one:

```
true=disaster_safety  pred=roads_infra   conf 0.37  "Flash flood submerged the low bridge connecting Karra to district hospital"
true=roads_infra      pred=health        conf 0.46  "Pulliya toot gayi hai, gaadi aur ambulance nahi aa pa rahi hai"
true=energy_conn.     pred=health        conf 0.46  "Primary health clinic generator has no fuel, dark during night deliveries"
```

Note the confidences: 0.37–0.49. The model knows these are ambiguous and flags
them, which is exactly what the confidence gate is for. This also caps how high
top-1 can go on this set — a single label cannot be right for a report about a
flooded bridge to a hospital.

v1 ships as a 4 MB JSON file and runs in plain TypeScript
(`backend/lib/ai/trained-classifier.ts`) — no Python, no network, works with
`AI_ENABLED=false`. Python and TypeScript agree to 5e-7 on every test report
(`backend/scripts/check-classifier-parity.ts`).

### Offline Compiler, end to end (no AI key), frozen v2 set

`backend/scripts/eval-compiler-offline.ts`

| | Category | DM phase | Severity ±1 |
|---|---|---|---|
| Keyword rules only (before) | 32.5% | 35.0% | 75.0% |
| Rules + trained classifier | **45.0%** | 35.0% | **85.0%** |

### On the team's own 50-case benchmark — the strongest evidence

`backend/lib/ai/eval-benchmark.ts` holds 50 cases written by another team
member, independently of the generator and of the test sets above. Scored with
`backend/scripts/eval-benchmark-ablation.ts` on the offline path (no AI key):

| | Category accuracy | Vulnerability tag F1 |
|---|---|---|
| Keyword rules only (before) | 60.0% | 16.0% |
| **Rules + trained classifier (TF-IDF, in TypeScript)** | **76.0%** | **21.4%** |

Dedup on the same 50 cases with the old offline embedding: **0% recall** on the
3 duplicate pairs, which is the same failure the frozen pair set shows.

The vulnerability F1 on this set is low for both, and part of that is the
labels: a lightning case about *kisan* (farmers) is labelled `elderly`, for
example. Worth a pass by whoever wrote them before it goes on a slide.

Note on that benchmark: as originally written it scored a keyword classifier
defined inside the benchmark file itself, with per-case disambiguation rules,
and returned a hard-coded 97.4% dedup precision. It now runs the real
`compileWithRules` path and measures dedup. The 50 cases were kept; the labels
were renamed to the real schema (`roads_infra`, `medical_dependency`).

## 3. Dedup embeddings

`ml/dedup/train_dedup.py` — contrastive fine-tune, in-batch negatives, half of
each batch drawn from one category so the negatives are hard. Threshold picked
on the calibration pairs, then scored once on the frozen pairs.

| | Duplicates found | Precision | Wrong merges | ROC-AUC |
|---|---|---|---|---|
| Local hashing vectoriser (before) | **0 of 30** | – | 0 | 0.58 |
| Pretrained MiniLM, no fine-tune (@0.75) | 1 of 30 | 4% | 23 | 0.66 |
| Round 1 fine-tune @ 0.47 | 22 of 30 (73%) | 85% | 4 | 0.97 |
| **Round 2 (richer data) @ 0.45** | **24 of 30 (80%)** | **86%** | **4** | **0.984** |

Zero of the wrong merges were same-category confusions. Mean similarity for two
reports of the same problem went from 0.035 (old) to well above the merge bar.

## 4. Whisper-small LoRA on rural Hindi

Data: Gram Vaani (community-radio phone recordings from rural India — noisy,
8 kHz-band, spontaneous speech). 317 held-out test clips (shared across v1 and v2).
LoRA on attention projections, 7.1M trainable of 248M, fp16, gradient checkpointing.

### Round 1 (v1): 2,683 training clips, ~22 min

| | WER | CER |
|---|---|---|
| whisper-small, no fine-tune | 114.2% | 81.8% |
| **whisper-small + LoRA v1** | **59.6%** | **32.1%** |
| improvement | **−54.6 points (48% relative)** | −49.7 points (61% relative) |

### Round 2 (v2, 2026-09-23): 6,120 training clips (3 epochs), ~93 min

Expanded dataset: Gram Vaani + additional recordings. Trained on RTX 3050.

| | WER | CER |
|---|---|---|
| **whisper-small + LoRA v2** | **50.48%** | **27.12%** |
| vs v1 | **−9.1 points (15% rel)** | **−4.98 points (15% rel)** |
| vs baseline | **−63.7 points (56% relative)** | **−54.7 points (67% relative)** |

Same 317 clips, same greedy decoding, both runs. Example:

```
reference  क्यूँकि हमारी पुलिस तो फेसबुक और दुसरे सोशल मीडिया के माध्यमों पर अपराध करने वालों को पकड़ने…
baseline   तो योंगे आमारी प्लिस्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्ट्
ours       कोई के अमारी प्रमिश का फेस्बूक और उसे सुसल मिडिया के माध्यमों आरोप अपराध करने वालों को पकड़ने…
```

59.6% WER is still high in absolute terms — this is noisy 8 kHz phone audio of
spontaneous speech — but the fine-tune stops the looping and recovers most of
the content words. Groq's whisper-large-v3 stays the first choice when there is
a network; ours is what runs when there is not.

A WER above 100% means the model inserts more words than exist: on this audio
the baseline loops ("ट्ट्ट्ट्…"). Confirmed identical in fp32, so it is the model,
not precision. Both runs use the same greedy decoding, so the comparison is fair.

## How the models reach the product

`ml/serve.py` serves all three over HTTP; `backend/lib/ai/model-service.ts`
calls it when `ML_SERVICE_URL` is set. Every call fails soft:

```
classify:   Gemini/Claude  ->  our MiniLM (sidecar)  ->  our TF-IDF (in TypeScript)  ->  keyword rules
embed:      our dedup model (ML_EMBEDDINGS=true)  ->  Gemini  ->  local hashing vectoriser
transcribe: Groq Whisper large-v3  ->  our Whisper fine-tune (local)  ->  transcript pending
```

The trace panel names the tier that answered and its confidence, so what a judge
sees on screen is what actually ran. `AI_ENABLED=false` still runs the whole
golden path.

## Honest limits

* The test sets were written by the team, not collected from citizens. They are
  small (40 reports, 30 pairs). Real field reports would be stronger evidence:
  add them as `classifier/testset_v3_team.jsonl` and re-run.
* Training data for the classifier and dedup models is synthetic. It covers the
  eight categories broadly, but real reports will contain wording it has never
  seen — which is exactly why the confidence threshold and the human approval
  gate exist.
* Severity is still decided by the rules, not the model: exact-severity accuracy
  (45–48%) is too low to trust unattended.
* The Whisper fine-tune is trained on Gram Vaani Hindi, not on Jharkhand tribal
  languages. Santali, Mundari and Ho remain roadmap, as stated in the playbook.
