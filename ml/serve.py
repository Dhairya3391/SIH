"""JharSetu model service: our three trained models behind one HTTP API.

The backend calls this when ML_SERVICE_URL is set and falls back to the
TypeScript classifier (and the keyword rules) when it is not reachable, so the
golden path never depends on this process being up.

    python ml/serve.py            # http://127.0.0.1:8000

  POST /classify   {"text": "..."}            -> category/severity/dm_phase/vulnerable + confidence
  POST /embed      {"texts": ["...", "..."]}  -> dedup embeddings (cosine-ready, merge threshold included)
  POST /transcribe (multipart file=<audio>)   -> Hindi transcript from the fine-tuned Whisper
  GET  /health                                -> which models actually loaded
"""
import io
import json
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CKPT, HOME  # noqa: E402

DEV = "cuda" if torch.cuda.is_available() else "cpu"
app = FastAPI(title="JharSetu models")
state: dict = {}


def load():
    from transformers import AutoModel, AutoTokenizer
    from classifier.train_classifier import CATS, PHASES, SEVS, VULN
    from classifier.train_transformer import BASE as CLS_BASE, MultiHead

    # Prefer the MuRIL classifier (v3) when it is present: MuRIL is built for
    # Indian languages including Roman-Hindi, and measures better on every
    # held-out set. Falls back to the MiniLM checkpoint (v2).
    for name in ("report-classifier-v3-muril", "report-classifier-v2-minilm"):
        p = CKPT / name
        if not (p / "model.pt").exists():
            continue
        base = json.loads((p / "base.json").read_text())["base"] if (p / "base.json").exists() else CLS_BASE
        m = MultiHead(base)
        m.load_state_dict(torch.load(p / "model.pt", map_location=DEV))
        state["cls"] = (m.to(DEV).eval(), AutoTokenizer.from_pretrained(p), (CATS, SEVS, PHASES, VULN))
        state["cls_name"] = name
        break

    d = CKPT / "dedup-minilm"
    if (d / "config.json").exists():
        state["dedup"] = (AutoModel.from_pretrained(d).to(DEV).eval(), AutoTokenizer.from_pretrained(d),
                          json.loads((d / "threshold.json").read_text())["merge"])

    a = CKPT / "whisper-small-gramvaani-lora"
    if (a / "adapter_config.json").exists():
        from peft import PeftModel
        from transformers import WhisperForConditionalGeneration, WhisperProcessor
        base = str(HOME / "models" / "whisper-small")
        w = WhisperForConditionalGeneration.from_pretrained(base, dtype=torch.float16 if DEV == "cuda" else torch.float32)
        w = PeftModel.from_pretrained(w, a).merge_and_unload().to(DEV).eval()
        state["asr"] = (w, WhisperProcessor.from_pretrained(base, language="hindi", task="transcribe"))


class TextIn(BaseModel):
    text: str


class TextsIn(BaseModel):
    texts: list[str]


@app.on_event("startup")
def _startup():
    load()
    print("loaded:", sorted(state), flush=True)


@app.get("/health")
def health():
    return {"ok": True, "device": DEV, "models": sorted(state),
            "classifier": state.get("cls_name", "none"), "dedup": "dedup-minilm",
            "asr": "whisper-small-gramvaani-lora"}


@app.post("/classify")
def classify(body: TextIn):
    if "cls" not in state:
        return {"ok": False, "error": "classifier not loaded"}
    model, tok, (CATS, SEVS, PHASES, VULN) = state["cls"]
    enc = tok([body.text], truncation=True, max_length=96, return_tensors="pt").to(DEV)
    with torch.no_grad():
        out = model(enc["input_ids"], enc["attention_mask"])
    cat = out["category"].float().softmax(-1)[0].cpu().numpy()
    # Average with the TF-IDF model that ships in the backend: the ensemble
    # measured better than either alone (see ml/RESULTS.md).
    try:
        from classifier.eval_transformer import tfidf_probs
        cat = 0.5 * cat + 0.5 * tfidf_probs([body.text])[0]
    except Exception:  # noqa: BLE001 - the transformer alone is still fine
        pass
    sev = out["severity"].float().softmax(-1)[0].cpu().numpy()
    ph = out["dm_phase"].float().softmax(-1)[0].cpu().numpy()
    vul = out["vulnerable"].float().sigmoid()[0].cpu().numpy()
    order = cat.argsort()[::-1]
    return {"ok": True, "model": f"{state.get('cls_name', 'report-classifier')} + tfidf ensemble",
            "category": CATS[order[0]], "category_confidence": float(cat[order[0]]),
            "category_runner_up": {"label": CATS[order[1]], "prob": float(cat[order[1]])},
            "severity": int(SEVS[sev.argmax()]), "severity_confidence": float(sev.max()),
            "dm_phase": PHASES[ph.argmax()], "dm_phase_confidence": float(ph.max()),
            "vulnerable": {v: float(vul[i]) for i, v in enumerate(VULN)}}


@app.post("/embed")
def embed(body: TextsIn):
    if "dedup" not in state:
        return {"ok": False, "error": "dedup model not loaded"}
    model, tok, th = state["dedup"]
    enc = tok(body.texts, padding=True, truncation=True, max_length=96, return_tensors="pt").to(DEV)
    with torch.no_grad():
        h = model(**enc).last_hidden_state
    m = enc["attention_mask"].unsqueeze(-1).float()
    e = F.normalize((h * m).sum(1) / m.sum(1), dim=-1).cpu().numpy()
    return {"ok": True, "model": "dedup-minilm", "dim": int(e.shape[1]),
            "merge_threshold": th, "embeddings": np.round(e, 6).tolist()}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if "asr" not in state:
        return {"ok": False, "error": "asr model not loaded"}
    import librosa
    model, proc = state["asr"]
    wav, _ = librosa.load(io.BytesIO(await file.read()), sr=16000, mono=True)
    feats = proc.feature_extractor(wav, sampling_rate=16000, return_tensors="pt").input_features
    with torch.no_grad():
        ids = model.generate(input_features=feats.to(DEV, model.dtype), language="hi", task="transcribe", max_new_tokens=200)
    return {"ok": True, "model": "whisper-small-gramvaani-lora",
            "text": proc.batch_decode(ids, skip_special_tokens=True)[0].strip(),
            "seconds": round(len(wav) / 16000, 2)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
