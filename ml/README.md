# JharSetu — trained models

Code lives here. The Python environment, datasets and checkpoints live outside
OneDrive in `C:\Users\rkgaj\jharsetu-ml` (set `JS_ML_HOME` to move it) so gigabytes
don't sync to the cloud.

| # | Model | Base | Result (frozen test set) | Script |
|---|---|---|---|---|
| 1 | Report classifier v1 (runs in TypeScript) | char n-gram TF-IDF + logistic regression | category 55%, 76% when confident | `classifier/train_classifier.py` |
| 2 | Report classifier v2 | fine-tuned multilingual MiniLM | category 62.5% | `classifier/train_transformer.py` |
| 3 | Dedup embeddings | contrastively fine-tuned MiniLM | 73% of duplicates at 85% precision (was 0%) | `dedup/train_dedup.py` |
| 4 | Speech to text for rural Hindi | `openai/whisper-small` + LoRA | WER 114% → 60% | `asr/train_whisper_lora.py` |

In production each model sits in a confidence cascade: trained model → LLM →
keyword rules. The trace panel labels which tier answered and with what
confidence. `AI_ENABLED=false` must keep working.

Results are recorded in `RESULTS.md` exactly as measured.

## Setup

```bash
python -m venv C:/Users/rkgaj/jharsetu-ml/.venv
C:/Users/rkgaj/jharsetu-ml/.venv/Scripts/python -m pip install torch --index-url https://download-r2.pytorch.org/whl/cu126
C:/Users/rkgaj/jharsetu-ml/.venv/Scripts/python -m pip install -r ml/requirements.txt
```

Hardware used: RTX 3050 Laptop (4 GB VRAM). On a slow connection use
`python ml/tools/fetch.py URL OUT` — it downloads in 8 resumable parallel parts
(this link capped each stream at ~200 KB/s but allowed ~600 KB/s in total).

## Reproduce everything

```bash
V=C:/Users/rkgaj/jharsetu-ml/.venv/Scripts/python
$V ml/classifier/generate_synthetic.py --n 20000     # training data
$V ml/classifier/train_classifier.py                 # v1 + export to backend JSON
$V ml/classifier/export_parity.py                    # then: npx tsx backend/scripts/check-classifier-parity.ts
$V ml/classifier/train_transformer.py --epochs 4     # v2  (~3 min on GPU)
$V ml/dedup/train_dedup.py --steps-per-epoch 600     # dedup (~2 min)
$V ml/asr/download_gramvaani.py --train-shards 7     # ~0.9 GB of rural audio
$V ml/asr/evaluate_wer.py                            # baseline WER
$V ml/asr/train_whisper_lora.py --epochs 2           # LoRA (~22 min)
$V ml/asr/evaluate_wer.py --adapter C:/Users/rkgaj/jharsetu-ml/checkpoints/whisper-small-gramvaani-lora
```

## Serving the models to the app

```bash
C:/Users/rkgaj/jharsetu-ml/.venv/Scripts/python ml/serve.py    # http://127.0.0.1:8000
```

Then in `backend/.env.local`:

```
ML_SERVICE_URL=http://127.0.0.1:8000   # classifier v2 + Whisper fine-tune
ML_EMBEDDINGS=true                     # also use our dedup embeddings (re-seed after switching!)
```

Both are optional. Without them the backend uses the TypeScript classifier and
the existing Gemini/keyword paths; `AI_ENABLED=false` still runs the golden
path. `ML_EMBEDDINGS` changes the vector space, so run `npm run db:reset`
afterwards or old rows will not compare against new ones.
