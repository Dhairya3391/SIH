"""Report classifier v2: fine-tuned multilingual MiniLM with four heads.

Same labels and same test sets as v1 (train_classifier.py), so the numbers are
directly comparable. The encoder is multilingual (50+ languages, trained on
paraphrases), so it can generalise to wording the synthetic data never used.

    python ml/classifier/train_transformer.py --epochs 3
"""
import argparse
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from transformers import AutoModel, AutoTokenizer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import CKPT, DATA, HOME, REPO_ML  # noqa: E402
from classifier.train_classifier import CATS, PHASES, SEVS, VULN, load, score  # noqa: E402

LOCAL_BASE = HOME / "models" / "paraphrase-multilingual-MiniLM-L12-v2"
BASE = str(LOCAL_BASE) if LOCAL_BASE.exists() else "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
OUT = CKPT / "report-classifier-v2-minilm"


class MultiHead(nn.Module):
    def __init__(self, base: str):
        super().__init__()
        self.enc = AutoModel.from_pretrained(base)
        h = self.enc.config.hidden_size
        self.drop = nn.Dropout(0.1)
        self.category = nn.Linear(h, len(CATS))
        self.severity = nn.Linear(h, len(SEVS))
        self.dm_phase = nn.Linear(h, len(PHASES))
        self.vulnerable = nn.Linear(h, len(VULN))

    def forward(self, input_ids, attention_mask):
        out = self.enc(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        m = attention_mask.unsqueeze(-1).float()
        pooled = self.drop((out * m).sum(1) / m.sum(1).clamp(min=1))  # mean pooling, as the encoder was trained
        return {k: getattr(self, k)(pooled) for k in ("category", "severity", "dm_phase", "vulnerable")}


def targets(rows, dev):
    return {
        "category": torch.tensor([CATS.index(r["category"]) for r in rows], device=dev),
        "severity": torch.tensor([SEVS.index(r["severity"]) for r in rows], device=dev),
        "dm_phase": torch.tensor([PHASES.index(r["dm_phase"]) for r in rows], device=dev),
        "vulnerable": torch.tensor([[float(v in r["vulnerable"]) for v in VULN] for r in rows], device=dev),
    }


@torch.no_grad()
def predict(model, tok, rows, dev, bs=64):
    model.eval()
    probs = {k: [] for k in ("category", "severity", "dm_phase", "vulnerable")}
    for i in range(0, len(rows), bs):
        enc = tok([r["text"] for r in rows[i:i + bs]], padding=True, truncation=True, max_length=96, return_tensors="pt").to(dev)
        with torch.autocast(dev, dtype=torch.float16, enabled=dev == "cuda"):
            out = model(enc["input_ids"], enc["attention_mask"])
        for k in ("category", "severity", "dm_phase"):
            probs[k].append(out[k].float().softmax(-1).cpu().numpy())
        probs["vulnerable"].append(out["vulnerable"].float().sigmoid().cpu().numpy())
    P = {k: np.concatenate(v) for k, v in probs.items()}
    pred = {}
    for k, labels in (("category", CATS), ("severity", SEVS), ("dm_phase", PHASES)):
        pred[k] = ([labels[i] for i in P[k].argmax(1)], P[k].max(1))
    pred["vulnerable"] = {v: P["vulnerable"][:, j] for j, v in enumerate(VULN)}
    return pred


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--bs", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--base", default=None, help="override the encoder (e.g. the local MuRIL path)")
    ap.add_argument("--out", default=None)
    ap.add_argument("--freeze-embeddings", action="store_true",
                    help="MuRIL's 197k-token embedding is 151M params; freezing it fits 4 GB")
    a = ap.parse_args()
    torch.manual_seed(0)
    dev = "cuda" if torch.cuda.is_available() else "cpu"

    rows = load(DATA / "classifier" / "synthetic.jsonl")
    random.Random(0).shuffle(rows)
    cut = int(0.9 * len(rows))
    train, val = rows[:cut], rows[cut:]
    test_v1 = load(REPO_ML / "classifier" / "testset_handwritten.jsonl")
    frozen = load(REPO_ML / "classifier" / "testset_v2_frozen.jsonl")

    base = a.base or BASE
    out_dir = Path(a.out) if a.out else OUT
    tok = AutoTokenizer.from_pretrained(base)
    model = MultiHead(base).to(dev)
    if a.freeze_embeddings:
        emb = model.enc.get_input_embeddings()
        emb.weight.requires_grad_(False)
        print(f"froze {emb.weight.numel() / 1e6:.0f}M embedding params", flush=True)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=a.lr, weight_decay=0.01)
    steps = a.epochs * (len(train) // a.bs)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=a.lr, total_steps=steps, pct_start=0.1)
    scaler = torch.amp.GradScaler(dev, enabled=dev == "cuda")
    # Vulnerable groups are rare positives (~13%), and the three category-style
    # losses drown that head out. Weight the positives, and the head itself.
    freq = np.array([[float(v in r["vulnerable"]) for v in VULN] for r in train]).mean(0)
    pos_weight = torch.tensor((1 - freq) / np.clip(freq, 1e-6, None), dtype=torch.float32, device=dev)
    print("vulnerable pos_weight:", pos_weight.round().tolist(), flush=True)
    ce, bce = nn.CrossEntropyLoss(), nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    VULN_LOSS_WEIGHT = 2.0
    print(f"device={dev} train={len(train)} steps={steps}", flush=True)

    t0, step = time.time(), 0
    for ep in range(a.epochs):
        model.train()
        random.Random(ep).shuffle(train)
        for i in range(0, len(train) - a.bs + 1, a.bs):
            batch = train[i:i + a.bs]
            enc = tok([r["text"] for r in batch], padding=True, truncation=True, max_length=96, return_tensors="pt").to(dev)
            y = targets(batch, dev)
            with torch.autocast(dev, dtype=torch.float16, enabled=dev == "cuda"):
                out = model(enc["input_ids"], enc["attention_mask"])
                loss = (ce(out["category"], y["category"]) + ce(out["severity"], y["severity"])
                        + ce(out["dm_phase"], y["dm_phase"])
                        + VULN_LOSS_WEIGHT * bce(out["vulnerable"].float(), y["vulnerable"]))
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            step += 1
            if step % 100 == 0:
                print(json.dumps({"epoch": ep, "step": step, "of": steps, "loss": round(loss.item(), 4),
                                  "min": round((time.time() - t0) / 60, 1)}), flush=True)
        # Monitor on synthetic validation only; the frozen set is scored once, at the end.
        res = score(predict(model, tok, val, dev), val, f"val after epoch {ep}")
        print("  val category_acc:", res["category_acc"], flush=True)

    results = []
    for title, rs in [("synthetic validation (in-distribution)", val),
                      ("hand-written test v1 (seen while widening the generator)", test_v1),
                      ("hand-written test v2 (frozen, never tuned on)", frozen)]:
        res = score(predict(model, tok, rs, dev), rs, title)
        results.append(res)
        print(json.dumps(res, indent=1, ensure_ascii=False))

    out_dir.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), out_dir / "model.pt")
    tok.save_pretrained(out_dir)
    (out_dir / "base.json").write_text(json.dumps({"base": base}))
    (out_dir / "labels.json").write_text(json.dumps({"category": CATS, "severity": SEVS, "dm_phase": PHASES, "vulnerable": VULN}))
    (CKPT / "classifier_v2_results.json").write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8")
    print("saved", out_dir)


if __name__ == "__main__":
    main()
