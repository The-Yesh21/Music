import json
import os

import pandas as pd

VALID = {"Happy", "Lonely", "Enjoyment"}
OUTPUT = "echotube/src/categorized_songs.json"


def normalize_title(title):
    return str(title).strip().lower()


def dedupe_songs(songs):
    seen = set()
    unique = []
    for song in songs:
        key = normalize_title(song["Title"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(song)
    return unique


def main():
    with open("labels.json", "r") as f:
        labels = json.load(f)

    df = (
        pd.read_excel("Top100Songs_Filled.xlsx")
        .dropna(subset=["Title"])
        .drop_duplicates(subset=["Title"], keep="first")
    )

    songs = []
    for _, row in df.iterrows():
        category = labels.get(str(row["Title"]))
        if category not in VALID:
            continue
        songs.append(
            {
                "Title": row["Title"],
                "Artist": row["Artist"] if pd.notna(row["Artist"]) else "",
                "Mood": row["Mood"] if pd.notna(row["Mood"]) else "",
                "Genre": row["Genre"] if pd.notna(row["Genre"]) else "",
                "Category": category,
                "isNew": False,
            }
        )

    if os.path.exists("custom_labeled_songs.json"):
        with open("custom_labeled_songs.json", "r") as f:
            custom_songs = json.load(f)
        for song in custom_songs:
            if song.get("Category") in VALID:
                songs.append(song)

    songs = dedupe_songs(songs)

    with open(OUTPUT, "w") as f:
        json.dump(songs, f, indent=2)

    counts = {cat: sum(1 for s in songs if s["Category"] == cat) for cat in VALID}
    print(f"Wrote {len(songs)} songs to {OUTPUT}")
    for cat in sorted(VALID):
        print(f"  {cat}: {counts[cat]}")


if __name__ == "__main__":
    main()
