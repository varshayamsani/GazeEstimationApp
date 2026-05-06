from __future__ import annotations

from functools import lru_cache
import random
import re


def _clean_sentence(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


@lru_cache(maxsize=1)
def _load_sst_pool() -> tuple[list[str], list[str]]:
    import pytreebank

    dataset = pytreebank.load_sst()
    very_negative: set[str] = set()
    very_positive: set[str] = set()

    for split_name in ("train", "dev", "test"):
        split = dataset[split_name]
        for example in split:
            for label, sentence in example.to_labeled_lines():
                sentence = _clean_sentence(sentence)
                if len(sentence) < 35:
                    continue
                if label == 0:
                    very_negative.add(sentence)
                elif label == 4:
                    very_positive.add(sentence)

    negatives = list(very_negative)
    positives = list(very_positive)
    rnd = random.Random(42)
    rnd.shuffle(negatives)
    rnd.shuffle(positives)
    return negatives, positives


def build_movie_review_map(
    imdb_ids: list[str],
    positives_per_movie: int = 2,
    negatives_per_movie: int = 2,
) -> dict[str, list[dict[str, str]]]:
    negatives, positives = _load_sst_pool()
    if not negatives or not positives:
        raise RuntimeError("SST pool is empty.")

    review_map: dict[str, list[dict[str, str]]] = {}
    pos_idx = 0
    neg_idx = 0

    for imdb_id in imdb_ids:
        reviews: list[dict[str, str]] = []
        for _ in range(positives_per_movie):
            reviews.append(
                {
                    "source": "SST-pytreebank (very positive)",
                    "sentiment": "positive",
                    "text": positives[pos_idx % len(positives)],
                }
            )
            pos_idx += 1
        for _ in range(negatives_per_movie):
            reviews.append(
                {
                    "source": "SST-pytreebank (very negative)",
                    "sentiment": "negative",
                    "text": negatives[neg_idx % len(negatives)],
                }
            )
            neg_idx += 1
        review_map[imdb_id] = reviews

    return review_map
