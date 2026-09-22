# Measured results

Every number here comes from a script in this repo and can be re-run. Nothing
is estimated, and nothing is copied from a paper.

Hardware: RTX 3050 Laptop (4 GB). All training done locally.

| # | Model | What it replaces | Headline (frozen test set) |
|---|---|---|---|
| 1 | Report classifier v1 — char n-gram TF-IDF + logistic regression, runs in TypeScript | keyword rules in `backend/lib/ai/fallback.ts` | category 55%, and 76% when confident |
| 2 | Report classifier v2 — fine-tuned multilingual MiniLM | v1, when the sidecar is up | **category 62.5%**, vulnerable-group F1 0.45 |
| 3 | Dedup embeddings — contrastively fine-tuned MiniLM | local hashing vectoriser in `backend/lib/ai/local-embed.ts` | **73% of duplicates found at 85% precision** (was 0%) |
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

Trained on 20,000 synthetic messy reports (Devanagari, Roman Hindi, English,
mixed; SMS noise, dropped vowels, typos) from `classifier/generate_synthetic.py`,
labelled exactly by the generator. Heads: category (8), severity (1–5), DM phase
(4), vulnerable groups (7, multi-label).

| Test set | v1 TF-IDF | v2 MiniLM |
|---|---|---|
| Synthetic validation (same generator — optimistic) | 100% | 98.9% |
| Hand-written v1 (*contaminated*: generator widened after seeing its errors) | 90.2% | — |
| **Frozen v2 (honest)** — category | **55.0%** | **62.5%** |
| Frozen v2 — severity within ±1 | 85.0% | 85.0% |
| Frozen v2 — DM phase | 47.5% | 55.0% |
| Frozen v2 — vulnerable groups (micro-F1) | 0.67 | 0.45 |
| Frozen v2 — category when confidence ≥ 0.7 | 76.5% (42.5% of reports) | 70.0% (50% of reports) |

v1 ships as a 4 MB JSON file and runs in plain TypeScript
(`backend/lib/ai/trained-classifier.ts`) — no Python, no network, works with
`AI_ENABLED=false`. Python and TypeScript agree to 5e-7 on every test report
(`backend/scripts/check-classifier-parity.ts`).

### Offline Compiler, end to end (no AI key), frozen v2 set

`backend/scripts/eval-compiler-offline.ts`

| | Category | DM phase | Severity ±1 |
|---|---|---|---|
| Keyword rules only (before) | 32.5% | 35.0% | 75.0% |
| Rules + trained classifier | **45.0%** | 37.5% | **85.0%** |

## 3. Dedup embeddings

`ml/dedup/train_dedup.py` — contrastive fine-tune, in-batch negatives, half of
each batch drawn from one category so the negatives are hard. Threshold picked
on the calibration pairs (0.47), then scored once on the frozen pairs.

| | Duplicates found | Precision | Wrong merges | ROC-AUC |
|---|---|---|---|---|
| Local hashing vectoriser (before) | **0 of 30** | – | 0 | 0.58 |
| Pretrained MiniLM, no fine-tune (@0.75) | 1 of 30 | 4% | 23 | 0.66 |
| **JharSetu fine-tuned MiniLM @ 0.47** | **22 of 30 (73%)** | **85%** | **4** | **0.97** |

Zero of the wrong merges were same-category confusions. Mean similarity for two
reports of the same problem went from 0.035 (old) to well above the merge bar.

## 4. Whisper-small LoRA on rural Hindi

Data: Gram Vaani (community-radio phone recordings from rural India — noisy,
8 kHz-band, spontaneous speech). 2,683 training clips (~7.5 h), 317 held-out
test clips. LoRA on attention projections, 7.1M trainable of 248M, fp16,
gradient checkpointing, ~22 min on the 3050.

| | WER | CER |
|---|---|---|
| whisper-small, no fine-tune | 114.2% | 81.8% |
| **whisper-small + our LoRA** | **59.6%** | **32.1%** |
| improvement | **−54.6 points (48% relative)** | −49.7 points (61% relative) |

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
