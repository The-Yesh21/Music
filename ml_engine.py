import pandas as pd
import json
import urllib.request
import urllib.parse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

print("Loading data...")
df = pd.read_excel('Top100Songs_Filled.xlsx').dropna(subset=['Title'])
with open('labels.json', 'r') as f:
    labels = json.load(f)

df['Label'] = df['Title'].map(labels)
train_df = df[df['Label'].isin(['Happy', 'Lonely', 'Enjoyment'])]

if len(train_df) == 0:
    print("Error: No valid labels found!")
    exit(1)

print(f"Training on {len(train_df)} labeled songs...")
# We use Title and Artist as the text feature because when we fetch from JioSaavn, 
# we won't reliably have Mood and Genre. The TF-IDF will learn artist and title word associations!
train_df['text_feature'] = train_df['Title'] + ' ' + train_df['Artist']

pipeline = make_pipeline(
    TfidfVectorizer(ngram_range=(1,2)),
    LogisticRegression(class_weight='balanced')
)
pipeline.fit(train_df['text_feature'], train_df['Label'])

print("Categorizing existing songs...")
existing_songs = []
for _, row in df.iterrows():
    # If they skipped it, we use the ML model to guess!
    label = row['Label']
    if label not in ['Happy', 'Lonely', 'Enjoyment']:
        label = pipeline.predict([f"{row['Title']} {row['Artist']}"])[0]
        
    existing_songs.append({
        'Title': row['Title'],
        'Artist': row['Artist'],
        'Mood': row['Mood'] if not pd.isna(row['Mood']) else '',
        'Genre': row['Genre'] if not pd.isna(row['Genre']) else '',
        'Category': label,
        'isNew': False
    })

print("Fetching new songs from JioSaavn to discover...")
def fetch_playlist_songs(query):
    try:
        q = urllib.parse.quote(query)
        req = urllib.request.Request(f"https://jio-blue.vercel.app/api/search/songs?query={q}&limit=30")
        res = urllib.request.urlopen(req)
        data = json.loads(res.read())
        return data.get('data', {}).get('results', [])
    except Exception as e:
        print("Error fetching", query, e)
        return []

new_tracks = fetch_playlist_songs("Latest Bollywood") + fetch_playlist_songs("Global Pop Hits") + fetch_playlist_songs("Lofi Chill") + fetch_playlist_songs("Party Anthems")

new_songs = []
seen_titles = set(row['Title'] for row in existing_songs)

for track in new_tracks:
    title = track.get('name', 'Unknown')
    if title in seen_titles:
        continue
    seen_titles.add(title)
    
    artist = track.get('primaryArtists', track.get('subtitle', 'Unknown'))
    pred = pipeline.predict([f"{title} {artist}"])[0]
    
    try:
        stream_url = track['downloadUrl'][0]['url']
        for u in track['downloadUrl']:
            if u['quality'] == '320kbps':
                stream_url = u['url']
                
        img = track['image'][0]['url']
        for i in track['image']:
            if i['quality'] == '500x500':
                img = i['url']
    except (KeyError, IndexError):
        continue
            
    new_songs.append({
        'Title': title,
        'Artist': artist,
        'Mood': 'Discovered',
        'Genre': 'Discovered',
        'Category': pred,
        'streamUrl': stream_url,
        'image': img,
        'isNew': True
    })

print(f"Added {len(new_songs)} newly discovered songs based on your taste!")

final_data = existing_songs + new_songs

with open('echotube/src/categorized_songs.json', 'w') as f:
    json.dump(final_data, f, indent=2)

print("ML Engine finished successfully!")
