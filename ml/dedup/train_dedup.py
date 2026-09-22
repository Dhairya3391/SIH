"""Dedup embeddings: fine-tune multilingual MiniLM so two villagers describing
the same problem in different words/scripts land close together, and different
problems (even in the same category) land apart.

Training pairs: two renderings of the same generator problem_id (different
script, phrase, noise). Loss: in-batch contrastive (MultipleNegativesRanking),
with one row per problem_id per batch so there are no false negatives.

Evaluation (frozen, hand-written): testset_pairs_frozen.jsonl.
  positives  = the 30 same-problem pairs
  negatives  = every cross-group pair (a_i, b_j), i != j; "hard" when same category
Reports precision/recall at the backend's merge bar (0.85) and review bar
(0.75), and ROC-AUC, for: pretrained MiniLM and our fine-tuned MiniLM. The
threshold for our model is chosen on synthetic validation pairs, never on test.

    python ml/dedup/train_dedup.py --epochs 1
"""
import argparse
import json
import random
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import roc_auc_score
from transformers import AutoModel, AutoTokenizer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import CKPT, DATA, HOME, REPO_ML  # noqa: E402

LOCAL_BASE = HOME / "models" / "paraphrase-multilingual-MiniLM-L12-v2"
BASE = str(LOCAL_BASE) if LOCAL_BASE.exists() else "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
OUT = CKPT / "dedup-minilm"


def embed(model, tok, texts, dev, bs=64):
    model.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(texts), bs):
            enc = tok(texts[i:i + bs], padding=True, truncation=True, max_length=96, return_tensors="pt").to(dev)
            h = model(**enc).last_hidden_state
            m = enc["attention_mask"].unsqueeze(-1).float()
            out.append(F.normalize((h * m).sum(1) / m.sum(1), dim=-1).cpu())
    return torch.cat(out).numpy()


def pair_scores(model, tok, pairs, dev):
    """pairs: list of (text_a, text_b, label, hard)."""
    texts = sorted({t for a, b, _, _ in pairs for t in (a, b)})
    idx = {t: i for i, t in enumerate(texts)}
    E = embed(model, tok, texts, dev)
    return np.array([float(E[idx[a]] @ E[idx[b]]) for a, b, _, _ in pairs])


def test_pairs():
    rows = [json.loads(l) for l in (REPO_ML / "dedup" / "testset_pairs_frozen.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    pairs = [(r["a"], r["b"], 1, False) for r in rows]
    for r in rows:
        for s in rows:
            if r["group"] != s["group"]:
                pairs.append((r["a"], s["b"], 0, r["category"] == s["category"]))
    return pairs


def metrics(scores, pairs, th):
    y = np.array([p[2] for p in pairs])
    hard = np.array([p[3] for p in pairs])
    pred = scores >= th
    tp = int((pred & (y == 1)).sum())
    fp = int((pred & (y == 0)).sum())
    return {"threshold": round(float(th), 3), "precision": round(tp / max(1, tp + fp), 3),
            "recall": round(tp / max(1, int(y.sum())), 3), "false_merges": fp,
            "false_merges_same_category": int((pred & (y == 0) & hard).sum())}


def evaluate(name, model, tok, dev, tuned_th=None):
    pairs = test_pairs()
    s = pair_scores(model, tok, pairs, dev)
    y = np.array([p[2] for p in pairs])
    hard = np.array([p[3] for p in pairs])
    res = {"model": name, "positives": int(y.sum()), "negatives": int((y == 0).sum()), "hard_negatives": int(hard.sum()),
           "roc_auc": round(float(roc_auc_score(y, s)), 4),
           "roc_auc_hard_only": round(float(roc_auc_score(y[(y == 1) | hard], s[(y == 1) | hard])), 4),
           "at_0.85": metrics(s, pairs, 0.85), "at_0.75": metrics(s, pairs, 0.75)}
    if tuned_th is not None:
        res["at_threshold_from_validation"] = metrics(s, pairs, tuned_th)
    return res


def synthetic_groups():
    groups, cats = defaultdict(list), {}
    for l in (DATA / "classifier" / "synthetic.jsonl").read_text(encoding="utf-8").splitlines():
        r = json.loads(l)
        groups[r["problem_id"]].append(r["text"])
        cats[r["problem_id"]] = r["category"]
    return groups, cats


def hard_batch(rng, train_pids, by_cat, bs):
    """Half the batch from one category, so in-batch negatives are hard:
    different problems that a topic-only model would call duplicates."""
    cat = rng.choice([c for c, ps in by_cat.items() if len(ps) >= 4])
    same = rng.sample(by_cat[cat], k=min(len(by_cat[cat]), bs // 2))
    rest = [p for p in train_pids if p not in same]
    return same + rng.sample(rest, k=min(bs - len(same), len(rest)))


def calibration_threshold(model, tok, dev):
    """Threshold from hand-written pairs that are NOT the test set."""
    rows = [json.loads(l) for l in (REPO_ML / "dedup" / "calibration_pairs.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    pairs = [(r["a"], r["b"], 1, False) for r in rows]
    for r in rows:
        for q in rows:
            if r["group"] != q["group"]:
                pairs.append((r["a"], q["b"], 0, r["category"] == q["category"]))
    s = pair_scores(model, tok, pairs, dev)
    y = np.array([p[2] for p in pairs])
    best, best_f1 = 0.5, -1.0
    for t in np.arange(0.3, 0.98, 0.01):
        tp = int(((s >= t) & (y == 1)).sum()); fp = int(((s >= t) & (y == 0)).sum())
        f1 = 2 * tp / max(1, 2 * tp + fp + int(y.sum()) - tp)
        if f1 > best_f1:
            best, best_f1 = float(t), f1
    print(f"calibration: {len(rows)} positive pairs, threshold {best:.2f} (F1 {best_f1:.3f})", flush=True)
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--bs", type=int, default=32)
    ap.add_argument("--steps-per-epoch", type=int, default=400)
    ap.add_argument("--lr", type=float, default=2e-5)
    a = ap.parse_args()
    rng = random.Random(0)
    torch.manual_seed(0)
    dev = "cuda" if torch.cuda.is_available() else "cpu"

    tok = AutoTokenizer.from_pretrained(BASE)
    model = AutoModel.from_pretrained(BASE).to(dev)
    results = [evaluate("pretrained MiniLM (no fine-tune)", model, tok, dev)]
    print(json.dumps(results[0], indent=1), flush=True)

    groups, cats = synthetic_groups()
    pids = sorted(groups)
    val_pids = set(rng.sample(pids, k=max(8, len(pids) // 6)))  # held-out problems for threshold choice
    train_pids = [p for p in pids if p not in val_pids]
    by_cat = defaultdict(list)
    for p in train_pids:
        by_cat[cats[p]].append(p)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr)
    t0 = time.time()
    for ep in range(a.epochs):
        model.train()
        for step in range(a.steps_per_epoch):
            batch = hard_batch(rng, train_pids, by_cat, min(a.bs, len(train_pids)))
            A, B = zip(*(rng.sample(groups[p], 2) for p in batch))
            enc = tok(list(A) + list(B), padding=True, truncation=True, max_length=96, return_tensors="pt").to(dev)
            with torch.autocast(dev, dtype=torch.float16, enabled=dev == "cuda"):
                h = model(**enc).last_hidden_state
            m = enc["attention_mask"].unsqueeze(-1).float()
            e = F.normalize((h.float() * m).sum(1) / m.sum(1), dim=-1)
            ea, eb = e[: len(batch)], e[len(batch):]
            logits = ea @ eb.T * 20.0
            lab = torch.arange(len(batch), device=dev)
            loss = (F.cross_entropy(logits, lab) + F.cross_entropy(logits.T, lab)) / 2
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            if (step + 1) % 50 == 0:
                print(json.dumps({"epoch": ep, "step": step + 1, "loss": round(loss.item(), 4),
                                  "min": round((time.time() - t0) / 60, 1)}), flush=True)

    best = calibration_threshold(model, tok, dev)

    results.append(evaluate("JharSetu fine-tuned MiniLM", model, tok, dev, tuned_th=best))
    print(json.dumps(results[-1], indent=1), flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(OUT)
    tok.save_pretrained(OUT)
    (OUT / "threshold.json").write_text(json.dumps({"merge": round(float(best), 3)}))
    (CKPT / "dedup_results.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    print("saved", OUT)


if __name__ == "__main__":
    main()
