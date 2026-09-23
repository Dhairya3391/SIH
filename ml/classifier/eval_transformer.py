"""Score a trained transformer checkpoint on every held-out set we have.

    python ml/classifier/eval_transformer.py [--ckpt <dir>] [--ensemble]

--ensemble also reports the transformer averaged with the TF-IDF model, which
is usually a point or two better than either alone.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import f1_score
from transformers import AutoTokenizer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import CKPT, REPO_ML  # noqa: E402
from classifier.train_classifier import CATS, VULN, load  # noqa: E402
from classifier.train_transformer import MultiHead, predict  # noqa: E402

SETS = {
    "frozen v2 (40 reports)": REPO_ML / "classifier" / "testset_v2_frozen.jsonl",
    "team benchmark (50 cases)": REPO_ML / "classifier" / "testset_team50.jsonl",
}


def tfidf_probs(texts):
    """Category probabilities from the shipped TF-IDF model, for the ensemble."""
    import unicodedata

    from sklearn.feature_extraction.text import TfidfVectorizer

    m = json.loads((REPO_ML.parent / "backend" / "lib" / "ai" / "models" / "report-classifier.json").read_text(encoding="utf-8"))
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=tuple(m["ngram"]), sublinear_tf=True,
                          preprocessor=lambda t: unicodedata.normalize("NFC", t).lower(), vocabulary=m["vocab"])
    vec.idf_ = np.array(m["idf"])
    X = vec.transform(texts)
    W = np.array(m["heads"]["category"]["coef"])
    b = np.array(m["heads"]["category"]["intercept"])
    z = (X @ W.T) + b
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


def report(name, rows, cat_pred, cat_conf, vul_probs):
    y = [r["category"] for r in rows]
    acc = float(np.mean([a == b for a, b in zip(y, cat_pred)]))
    Y = np.array([[v in r["vulnerable"] for v in VULN] for r in rows], int)
    P = (np.stack([vul_probs[v] for v in VULN], 1) >= 0.5).astype(int)
    out = {"set": name, "n": len(rows), "category_acc": round(acc, 4),
           "vulnerable_micro_f1": round(f1_score(Y, P, average="micro", zero_division=0), 4)}
    conf = np.array(cat_conf)
    for th in (0.6, 0.7, 0.8):
        m = conf >= th
        out[f"acc@conf>={th}"] = round(float(np.mean(np.array(y)[m] == np.array(cat_pred)[m])), 4) if m.any() else None
        out[f"coverage@{th}"] = round(float(m.mean()), 4)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default=str(CKPT / "report-classifier-v2-minilm"))
    ap.add_argument("--ensemble", action="store_true")
    a = ap.parse_args()
    ckpt = Path(a.ckpt)
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    base = json.loads((ckpt / "base.json").read_text())["base"] if (ckpt / "base.json").exists() else None
    tok = AutoTokenizer.from_pretrained(ckpt)
    model = MultiHead(base or str(ckpt))
    model.load_state_dict(torch.load(ckpt / "model.pt", map_location=dev))
    model.to(dev).eval()

    results = []
    for name, path in SETS.items():
        rows = load(path)
        pred = predict(model, tok, rows, dev)
        results.append(report(f"{ckpt.name} — {name}", rows, pred["category"][0], pred["category"][1], pred["vulnerable"]))
        print(json.dumps(results[-1], ensure_ascii=False))

        if a.ensemble:
            texts = [r["text"] for r in rows]
            P_t = np.zeros((len(rows), len(CATS)))
            for i, c in enumerate(pred["category"][0]):
                P_t[i] = 0  # rebuilt below from probabilities
            # recompute full transformer probabilities
            import torch as T
            probs = []
            for i in range(0, len(texts), 64):
                enc = tok(texts[i:i + 64], padding=True, truncation=True, max_length=96, return_tensors="pt").to(dev)
                with T.no_grad():
                    probs.append(model(enc["input_ids"], enc["attention_mask"])["category"].float().softmax(-1).cpu().numpy())
            P_t = np.concatenate(probs)
            P_mix = 0.5 * P_t + 0.5 * tfidf_probs(texts)
            results.append(report(f"ensemble (transformer + TF-IDF) — {name}", rows,
                                  [CATS[i] for i in P_mix.argmax(1)], P_mix.max(1), pred["vulnerable"]))
            print(json.dumps(results[-1], ensure_ascii=False))

    (CKPT / "eval_all_sets.json").write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
