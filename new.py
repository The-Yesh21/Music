import pandas as pd
import musicbrainzngs
from tqdm import tqdm
import time

musicbrainzngs.set_useragent(
    "EchoTune",
    "1.0",
    "your@email.com"
)

df = pd.read_excel("Top100Songs.xlsx")

genres = []
moods = []

def infer_mood(tags):
    text = " ".join(tags).lower()

    if any(x in text for x in ["pop", "dance"]):
        return "Happy"
    if any(x in text for x in ["rock", "metal"]):
        return "Energetic"
    if any(x in text for x in ["indie", "folk", "acoustic"]):
        return "Chill"
    if any(x in text for x in ["sad", "blues"]):
        return "Melancholic"

    return "Neutral"

for _, row in tqdm(df.iterrows(), total=len(df)):

    title = str(row["Title"])
    artist = str(row["Artist"])

    try:
        result = musicbrainzngs.search_recordings(
            recording=title,
            artist=artist,
            limit=1
        )

        recordings = result.get("recording-list", [])

        if recordings:

            rec = recordings[0]

            tags = [
                tag["name"]
                for tag in rec.get("tag-list", [])
            ]

            genre = ", ".join(tags)

            genres.append(genre)
            moods.append(infer_mood(tags))

        else:
            genres.append("")
            moods.append("")

    except Exception as e:
        print("Error:", title, e)

        genres.append("")
        moods.append("")

    time.sleep(1)

df["Genre"] = genres
df["Mood"] = moods

df.to_excel(
    "Top100Songs_Enriched.xlsx",
    index=False
)

print("Done!")