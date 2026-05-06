from pathlib import Path
import re

import pytreebank


BASE_DIR = Path(__file__).resolve().parent.parent
SST_PATH = BASE_DIR / "data" / "stanford_sentiment_treebank"
MAX_WORDS = 150

MOVIE_METADATA = [
    {
        "imdb_id": "tt0111161",
        "title": "The Shawshank Redemption",
        "year": 1994,
        "genre": "Drama",
        "poster_url": "/static/survey_app/posters/the_shawshank_redemption.svg",
        "description": "Two imprisoned men forge a friendship over years, finding hope and redemption through small acts of resistance.",
    },
    {
        "imdb_id": "tt0068646",
        "title": "The Godfather",
        "year": 1972,
        "genre": "Crime, Drama",
        "poster_url": "/static/survey_app/posters/the_godfather.svg",
        "description": "The aging patriarch of a crime family transfers control of his empire to his reluctant son.",
    },
    {
        "imdb_id": "tt0468569",
        "title": "The Dark Knight",
        "year": 2008,
        "genre": "Action, Crime, Drama",
        "poster_url": "/static/survey_app/posters/the_dark_knight.svg",
        "description": "Batman faces a chaotic adversary who pushes Gotham to the edge and tests the limits of justice.",
    },
    {
        "imdb_id": "tt0109830",
        "title": "Forrest Gump",
        "year": 1994,
        "genre": "Drama, Romance",
        "poster_url": "/static/survey_app/posters/forrest_gump.svg",
        "description": "A kind-hearted man experiences major moments of U.S. history while holding onto unwavering love and optimism.",
    },
    {
        "imdb_id": "tt0133093",
        "title": "The Matrix",
        "year": 1999,
        "genre": "Action, Sci-Fi",
        "poster_url": "/static/survey_app/posters/the_matrix.svg",
        "description": "A hacker discovers reality is a simulation and joins a rebellion against machine control.",
    },
    {
        "imdb_id": "tt0167260",
        "title": "The Lord of the Rings: The Return of the King",
        "year": 2003,
        "genre": "Adventure, Drama, Fantasy",
        "poster_url": "/static/survey_app/posters/lotr_return_of_the_king.svg",
        "description": "The final battle for Middle-earth unfolds as friends race to destroy the ring.",
    },
]


def normalize_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    replacements = {
        " n't": "n't",
        " 's": "'s",
        " 're": "'re",
        " 've": "'ve",
        " 'm": "'m",
        " 'd": "'d",
        " 'll": "'ll",
        " ,": ",",
        " .": ".",
        " !": "!",
        " ?": "?",
        " ;": ";",
        " :": ":",
        "( ": "(",
        " )": ")",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def truncate_words(text: str, limit: int = MAX_WORDS) -> str:
    words = text.split()
    if len(words) <= limit:
        return text
    return " ".join(words[:limit]).rstrip(" ,;:") + "..."


def is_complete_review_excerpt(text: str) -> bool:
    return text.endswith((".", "!", "?", ".'", "!'","?'","''"))


def load_review_pool() -> dict[str, list[str]]:
    dataset = pytreebank.load_sst(path=str(SST_PATH))
    pools = {"positive": [], "neutral": [], "negative": []}

    for split_name in ("train", "dev", "test"):
        for tree in dataset[split_name]:
            text = truncate_words(normalize_text(tree.to_lines()[0]))
            word_count = len(text.split())
            if word_count < 40 or word_count > 120:
                continue
            if text.startswith("..."):
                continue
            if not is_complete_review_excerpt(text):
                continue

            if tree.label >= 3:
                sentiment = "positive"
            elif tree.label == 2:
                sentiment = "neutral"
            else:
                sentiment = "negative"

            if text not in pools[sentiment]:
                pools[sentiment].append(text)

            if all(len(values) >= 8 for values in pools.values()):
                return pools

    return pools


def build_movies() -> list[dict]:
    review_pool = load_review_pool()
    sentiment_plan = [
        ("positive", "positive"),
        ("positive", "neutral"),
        ("positive", "negative"),
        ("neutral", "positive"),
        ("negative", "positive"),
        ("positive", "neutral"),
    ]
    indices = {"positive": 0, "neutral": 0, "negative": 0}

    movies = []
    for metadata, sentiments in zip(MOVIE_METADATA, sentiment_plan, strict=True):
        reviews = []
        for sentiment in sentiments:
            excerpts = review_pool[sentiment][indices[sentiment]:indices[sentiment] + 2]
            if len(excerpts) < 2:
                excerpts = review_pool[sentiment][indices[sentiment]:]
            indices[sentiment] += len(excerpts)
            if len(excerpts) == 1:
                text = excerpts[0]
            else:
                text = f'Review excerpt 1: "{excerpts[0]}" Review excerpt 2: "{excerpts[1]}"'
            text = truncate_words(text, limit=135)
            reviews.append({"sentiment": sentiment, "text": text})
        movies.append({**metadata, "reviews": reviews})
    return movies


MOVIES = build_movies()
