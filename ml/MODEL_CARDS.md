# Model cards

Four models trained for JharSetu, on one RTX 3050 laptop. Measured numbers are
in `RESULTS.md`; this file is about intended use, data and limits.

Shared rules, from `AGENTS.md`: every model **proposes**, a coordinator
**decides**. No model rejects a report, dispatches anyone, predicts a disaster,
or writes safety or medical advice. Every model has a fallback, and the golden
path runs with all of them switched off.

---

## 1. `report-classifier` v1 — TF-IDF + logistic regression

* **Task**: category (8), severity (1–5), DM phase (4), vulnerable groups (7).
* **Where it runs**: in the backend process, in TypeScript, from a 4 MB JSON
  weights file. No Python, no network, ~1 ms per report.
* **Training data**: 20,000 synthetic reports from `classifier/generate_synthetic.py`
  (Devanagari, Roman Hindi, English, mixed; SMS noise). Labels are exact,
  because the generator produced them.
* **Measured**: 55.0% category accuracy on 40 frozen hand-written reports;
  76.5% on the 42.5% of reports where its confidence is ≥ 0.7.
* **Limits**: recognises spellings, not meanings. Unseen topics fall through to
  the keyword rules, which is why the ≥ 0.7 bar exists.
* **Use**: only above the confidence bar; below it the brief says the category
  is uncertain and names both candidates.

## 2. `report-classifier-v2-minilm` — fine-tuned multilingual MiniLM

* **Base**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
  (Apache-2.0), 118M parameters, with four heads.
* **Training**: 4 epochs on the same 20,000 synthetic reports, ~3 min on the GPU.
  Positives in the vulnerable-groups head are weighted (they are ~13% of rows,
  and without weighting that head learns nothing).
* **Measured**: 62.5% category accuracy on the frozen set; vulnerable-group
  micro-F1 0.45; DM phase 55%.
* **Where it runs**: `ml/serve.py` sidecar (too large for a serverless function).
* **Limits**: trained only on synthetic wording. Severity is still left to the
  rules (exact-severity accuracy ~45%).

## 3. `dedup-minilm` — contrastively fine-tuned MiniLM

* **Task**: decide whether two reports describe the same problem, so 31 voices
  become one challenge rather than 31 tickets.
* **Training**: in-batch contrastive learning over renderings of the same
  generator problem; half of each batch is drawn from one category so the
  negatives are hard (different problems that a topic-only model would merge).
* **Threshold**: 0.47, chosen on 18 hand-written calibration pairs that are not
  the test set. Gemini's 0.85 bar does not apply: this is a different vector
  space and it scores lower for the same pair.
* **Measured** on 30 frozen pairs plus 870 negatives: 73% of duplicates found at
  85% precision, 4 wrong merges, none of them within the same category.
  ROC-AUC 0.97 against 0.58 for the hashing vectoriser it replaces.
* **Limits**: 384 dimensions, zero-padded into the database's `vector(768)`.
  Vectors from different models are not comparable, so switching the embedding
  source requires re-embedding every row. That is why `ML_EMBEDDINGS` is off by
  default.

## 4. `whisper-small-gramvaani-lora` — speech to text for rural Hindi

* **Base**: `openai/whisper-small` (MIT), LoRA on attention projections,
  7.1M trainable of 248M.
* **Training data**: Gram Vaani Hindi — community-radio phone recordings from
  rural India: noisy, 8 kHz-band, spontaneous speech. 2,683 clips (~7.5 hours).
  ~22 min on the GPU. Verify the dataset licence before any non-demo use.
* **Measured** on 317 held-out clips: WER 114.2% → **59.6%**, CER 81.8% → **32.1%**.
  The baseline's WER exceeds 100% because it loops on this audio.
* **Where it runs**: the sidecar. Groq's whisper-large-v3 remains first choice
  when the network is up; this is the offline tier, which previously did not
  exist (a failed transcription just left the report without a transcript).
* **Limits**: Hindi only. Jharkhand tribal languages (Santali, Mundari, Ho) are
  **roadmap, not built** — do not claim them. 60% WER means roughly three words
  in five are right, so the transcript is a draft for a human, never evidence.

---

## Data provenance

| Source | Used for | Licence |
|---|---|---|
| `classifier/generate_synthetic.py` (ours) | classifier + dedup training | ours |
| Hand-written test/calibration sets (ours) | evaluation only | ours |
| Gram Vaani Hindi (HF mirror `TheAIchemist13/gramvaani_preprocessed_hi_*`) | Whisper fine-tune | check upstream before non-demo use |
| `openai/whisper-small` | ASR base | MIT |
| `paraphrase-multilingual-MiniLM-L12-v2` | classifier v2 + dedup base | Apache-2.0 |

No citizen data, no personal data, and nothing from the production database was
used to train anything.
