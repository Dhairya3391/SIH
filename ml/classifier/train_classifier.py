"""Multi-head report classifier: category, severity, DM phase, vulnerable groups.

Character n-gram TF-IDF (robust to Hinglish spelling: pani/paani/panee) feeding
logistic-regression heads. Exports weights to JSON so the backend runs it in
plain TypeScript (backend/lib/ai/trained-classifier.ts), no Python server.

Evaluated twice, and both numbers are reported:
  * synthetic validation split  (same generator: in-distribution, optimistic)
  * hand-written test set       (different wording: the honest number)

    python ml/classifier/train_classifier.py
"""
import json
import random
import sys
import unicodedata
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score, confusion_matrix

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common import CKPT, DATA, REPO_ML  # noqa: E402

CATS = ["disaster_safety", "water", "health", "education", "agriculture", "roads_infra", "energy_connectivity", "environment"]
PHASES = ["mitigation", "preparedness", "response", "recovery"]
SEVS = [1, 2, 3, 4, 5]
VULN = ["children", "elderly", "disability", "pregnancy", "medical_dependency", "isolated", "no_signal"]
NGRAM = (2, 5)
MAX_FEATURES = 30000
EXPORT = REPO_ML.parent / "backend" / "lib" / "ai" / "models" / "report-classifier.json"


def prep(t: str) -> str:
    return unicodedata.normalize("NFC", t).lower()


def load(p: Path):
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def fit_heads(X, rows):
    heads = {}
    for name, labels, key in [("category", CATS, "category"), ("severity", SEVS, "severity"), ("dm_phase", PHASES, "dm_phase")]:
        y = np.array([labels.index(r[key]) for r in rows])
        heads[name] = LogisticRegression(C=4.0, max_iter=2000).fit(X, y)
    heads["vulnerable"] = {}
    for v in VULN:
        y = np.array([v in r["vulnerable"] for r in rows], dtype=int)
        heads["vulnerable"][v] = LogisticRegression(C=4.0, max_iter=2000, class_weight="balanced").fit(X, y)
    return heads


def predict(heads, X):
    out = {}
    for name, labels in [("category", CATS), ("severity", SEVS), ("dm_phase", PHASES)]:
        p = heads[name].predict_proba(X)
        out[name] = ([labels[i] for i in p.argmax(1)], p.max(1))
    out["vulnerable"] = {v: heads["vulnerable"][v].predict_proba(X)[:, 1] for v in VULN}
    return out


def score(pred, rows, title):
    res = {"set": title, "n": len(rows)}
    yc = [r["category"] for r in rows]
    res["category_acc"] = accuracy_score(yc, pred["category"][0])
    res["category_macro_f1"] = f1_score(yc, pred["category"][0], average="macro", labels=CATS, zero_division=0)
    ys = [r["severity"] for r in rows]
    ps = pred["severity"][0]
    res["severity_exact"] = accuracy_score(ys, ps)
    res["severity_within_1"] = float(np.mean([abs(a - b) <= 1 for a, b in zip(ys, ps)]))
    res["dm_phase_acc"] = accuracy_score([r["dm_phase"] for r in rows], pred["dm_phase"][0])
    Y = np.array([[v in r["vulnerable"] for v in VULN] for r in rows], dtype=int)
    P = np.array([pred["vulnerable"][v] >= 0.5 for v in VULN], dtype=int).T
    res["vulnerable_micro_f1"] = f1_score(Y, P, average="micro", zero_division=0)
    # Confidence routing: how accurate is the category when the model is sure?
    conf = pred["category"][1]
    for th in (0.5, 0.6, 0.7):
        m = conf >= th
        res[f"category_acc_when_conf>={th}"] = float(np.mean(np.array(yc)[m] == np.array(pred["category"][0])[m])) if m.any() else None
        res[f"coverage_conf>={th}"] = float(m.mean())
    return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in res.items()}


def export(vec, heads):
    vocab = {t: int(i) for t, i in vec.vocabulary_.items()}
    r = lambda a: [round(float(x), 5) for x in a]  # noqa: E731

    def mc(m, labels):
        return {"labels": labels, "coef": [r(row) for row in m.coef_], "intercept": r(m.intercept_)}

    model = {
        "version": 1,
        "kind": "char_wb tfidf + logistic regression",
        "ngram": list(NGRAM), "sublinear_tf": True,
        "vocab": vocab, "idf": r(vec.idf_),
        "heads": {
            "category": mc(heads["category"], CATS),
            "severity": mc(heads["severity"], SEVS),
            "dm_phase": mc(heads["dm_phase"], PHASES),
            "vulnerable": {v: {"coef": r(m.coef_[0]), "intercept": float(m.intercept_[0])} for v, m in heads["vulnerable"].items()},
        },
    }
    EXPORT.parent.mkdir(parents=True, exist_ok=True)
    EXPORT.write_text(json.dumps(model, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"exported {EXPORT} ({EXPORT.stat().st_size / 1e6:.1f} MB)")


def main():
    rows = load(DATA / "classifier" / "synthetic.jsonl")
    random.Random(0).shuffle(rows)
    cut = int(0.9 * len(rows))
    train, val = rows[:cut], rows[cut:]
    test = load(REPO_ML / "classifier" / "testset_handwritten.jsonl")
    # v2 was written after the generator was last changed and is never used to
    # tune anything. It is the number that goes on the slide.
    frozen = load(REPO_ML / "classifier" / "testset_v2_frozen.jsonl")

    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=NGRAM, sublinear_tf=True, min_df=2,
                          max_features=MAX_FEATURES, preprocessor=prep, dtype=np.float32)
    Xtr = vec.fit_transform([r["text"] for r in train])
    heads = fit_heads(Xtr, train)

    results = []
    for title, rs in [("synthetic validation (in-distribution)", val),
                      ("hand-written test v1 (seen while widening the generator)", test),
                      ("hand-written test v2 (frozen, never tuned on)", frozen)]:
        pred = predict(heads, vec.transform([r["text"] for r in rs]))
        res = score(pred, rs, title)
        results.append(res)
        print(json.dumps(res, indent=1, ensure_ascii=False))
        if "v2" in title:
            print(classification_report([r["category"] for r in rs], pred["category"][0], labels=CATS, zero_division=0))
            print("confusion (rows=true, cols=pred, order=CATS)")
            print(confusion_matrix([r["category"] for r in rs], pred["category"][0], labels=CATS))
            with open(CKPT / "classifier_test_predictions.tsv", "w", encoding="utf-8") as f:
                f.write("text\ttrue\tpred\tconf\n")
                for r, c, p in zip(rs, pred["category"][0], pred["category"][1]):
                    f.write(f"{r['text']}\t{r['category']}\t{c}\t{p:.2f}\n")

    (CKPT / "classifier_results.json").write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8")
    export(vec, heads)


if __name__ == "__main__":
    main()
