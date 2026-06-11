import os
import json
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler

app = Flask(__name__)
CORS(app)

# Global variables for the ML model
df_songs = None
tfidf_matrix = None
vectorizer = None
normalized_numerical = None
songs_list = []

# Load database and train similarity model
def init_recommendation_engine():
    global df_songs, tfidf_matrix, vectorizer, normalized_numerical, songs_list
    
    excel_path = "Top100Songs_Filled.xlsx"
    json_path = os.path.join("src", "constants", "taste_songs.json")
    
    # Try loading from Excel first, fallback to taste_songs.json
    if os.path.exists(excel_path):
        try:
            df_songs = pd.read_excel(excel_path)
            print(f"Loaded {len(df_songs)} songs from {excel_path}")
        except Exception as e:
            print(f"Failed to read Excel {excel_path}: {e}")
            
    if df_songs is None and os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            # Map json fields to match Excel columns
            mapped_data = []
            for item in data:
                mapped_data.append({
                    'Title': item.get('Title') or item.get('title'),
                    'Artist': item.get('Artist') or item.get('artist'),
                    'Genre': item.get('Genre') or item.get('genre') or 'Unknown',
                    'Mood': item.get('Mood') or item.get('mood') or 'Neutral',
                    'BPM / Tempo': item.get('BPM / Tempo') or item.get('bpm') or 100,
                    'Rating / Preference Score': item.get('Rating / Preference Score') or item.get('rating') or 50
                })
            df_songs = pd.DataFrame(mapped_data)
            print(f"Loaded {len(df_songs)} songs from {json_path}")
        except Exception as e:
            print(f"Failed to read JSON {json_path}: {e}")
            
    if df_songs is None:
        # Fallback empty dataframe with standard columns
        df_songs = pd.DataFrame(columns=['Title', 'Artist', 'Genre', 'Mood', 'BPM / Tempo', 'Rating / Preference Score'])
        print("Warning: No song database files found! Running with empty dataset.")
        return

    # Clean and fill missing values
    df_songs['Genre'] = df_songs['Genre'].fillna('Unknown').astype(str)
    df_songs['Mood'] = df_songs['Mood'].fillna('Neutral').astype(str)
    df_songs['BPM / Tempo'] = pd.to_numeric(df_songs['BPM / Tempo'], errors='coerce').fillna(100)
    df_songs['Rating / Preference Score'] = pd.to_numeric(df_songs['Rating / Preference Score'], errors='coerce').fillna(50)
    df_songs['Title'] = df_songs['Title'].fillna('Unknown').astype(str)
    df_songs['Artist'] = df_songs['Artist'].fillna('Unknown').astype(str)

    # Assign persistent IDs to memory list
    songs_list = []
    for idx, row in df_songs.iterrows():
        song_id = f"python_{idx}"
        songs_list.append({
            'id': song_id,
            'title': row['Title'],
            'artist': row['Artist'],
            'genre': row['Genre'],
            'mood': row['Mood'],
            'bpm': int(row['BPM / Tempo']),
            'rating': int(row['Rating / Preference Score']),
            'artwork': f"https://picsum.photos/seed/pythonsong{idx}/400/400"
        })

    # Prepare features for Content-Based Filtering
    # 1. Text metadata combination (Title + Artist + Genre + Mood)
    df_songs['metadata_soup'] = df_songs.apply(
        lambda r: f"{r['Title']} {r['Artist']} {r['Genre']} {r['Mood']} {r['Genre']} {r['Mood']}", 
        axis=1
    )
    
    # 2. Extract TF-IDF features
    vectorizer = TfidfVectorizer(stop_words='english')
    tfidf_matrix = vectorizer.fit_transform(df_songs['metadata_soup'])

    # 3. Normalize numerical features (BPM and Preference Rating)
    scaler = MinMaxScaler()
    numerical_features = df_songs[['BPM / Tempo', 'Rating / Preference Score']].values
    normalized_numerical = scaler.fit_transform(numerical_features)
    print("ML Recommendation Model trained successfully!")

# Initialize when starting
init_recommendation_engine()

# Helper to find a song index in the dataframe
def find_song_index(title, artist):
    if df_songs is None or len(df_songs) == 0:
        return -1
    
    # Try exact match first
    matches = df_songs[
        (df_songs['Title'].str.lower() == title.lower()) & 
        (df_songs['Artist'].str.lower() == artist.lower())
    ]
    if not matches.empty:
        return matches.index[0]
        
    # Loose match on title contains
    matches = df_songs[df_songs['Title'].str.lower().str.contains(title.lower(), na=False)]
    if not matches.empty:
        return matches.index[0]
        
    return -1

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'status': 'online',
        'database_size': len(songs_list),
        'engine': 'Python scikit-learn Content-Based Filtering'
    })

@app.route('/api/recommend', methods=['POST'])
def recommend_songs():
    if df_songs is None or len(df_songs) == 0:
        return jsonify([])

    data = request.json or {}
    seed_title = data.get('seed_title', '')
    seed_artist = data.get('seed_artist', '')
    favorites = data.get('favorites', [])  # list of titles/artists
    dislikes = data.get('dislikes', [])    # list of titles/artists
    history = data.get('history', [])      # list of played song titles/artists
    limit = data.get('limit', 15)

    # Default profile weights
    favorite_genres = {}
    favorite_moods = {}
    disliked_genres = set()
    disliked_moods = set()
    
    # Extract user preference profiles from history and favorites list
    for fav in favorites:
        title = fav.get('title', '')
        artist = fav.get('artist', '')
        idx = find_song_index(title, artist)
        if idx != -1:
            g = df_songs.loc[idx, 'Genre']
            m = df_songs.loc[idx, 'Mood']
            favorite_genres[g] = favorite_genres.get(g, 0) + 2
            favorite_moods[m] = favorite_moods.get(m, 0) + 2

    for dis in dislikes:
        title = dis.get('title', '')
        artist = dis.get('artist', '')
        idx = find_song_index(title, artist)
        if idx != -1:
            disliked_genres.add(df_songs.loc[idx, 'Genre'])
            disliked_moods.add(df_songs.loc[idx, 'Mood'])

    # Find the seed song index
    seed_idx = find_song_index(seed_title, seed_artist)
    
    # Compute base similarity scores
    if seed_idx != -1:
        # Calculate cosine similarity using TF-IDF metadata
        meta_sim = cosine_similarity(tfidf_matrix[seed_idx], tfidf_matrix).flatten()
        
        # Calculate distance-based numerical similarity (BPM and Rating)
        seed_num = normalized_numerical[seed_idx].reshape(1, -1)
        num_sim = cosine_similarity(seed_num, normalized_numerical).flatten()
        
        # Combined composite similarity (70% text metadata, 30% tempo/rating)
        similarity_scores = (meta_sim * 0.7) + (num_sim * 0.3)
    else:
        # If no valid seed song, base on overall preference ratings
        ratings = df_songs['Rating / Preference Score'].values
        similarity_scores = ratings / max(ratings) if len(ratings) > 0 else np.zeros(len(df_songs))

    # Apply preference adjustments & penalties to candidate songs
    final_scores = []
    for idx, row in df_songs.iterrows():
        song_id = f"python_{idx}"
        title = row['Title']
        artist = row['Artist']
        genre = row['Genre']
        mood = row['Mood']
        
        # 1. Skip seed song
        if idx == seed_idx:
            continue
            
        # 2. Exclude dislikes
        is_disliked = False
        for dis in dislikes:
            if dis.get('title', '').lower() == title.lower():
                is_disliked = True
                break
        if is_disliked or genre in disliked_genres or mood in disliked_moods:
            continue

        score = similarity_scores[idx]
        
        # 3. Boost based on genre and mood weights
        score += favorite_genres.get(genre, 0) * 0.1
        score += favorite_moods.get(mood, 0) * 0.1
        
        # 4. Boost for high-rated songs
        score += (row['Rating / Preference Score'] / 100.0) * 0.15
        
        # 5. History repetition penalty (avoid fatigue)
        recent_play_count = 0
        for hist in history:
            if hist.get('title', '').lower() == title.lower():
                recent_play_count += 1
        score -= recent_play_count * 0.2
        
        final_scores.append({
            'index': idx,
            'score': float(score)
        })

    # Sort candidates by final recommendation score
    final_scores = sorted(final_scores, key=lambda x: x['score'], reverse=True)
    
    # Retrieve recommended songs list
    recommendations = []
    for item in final_scores[:limit]:
        idx = item['index']
        recommendations.append(songs_list[idx])
        
    return jsonify(recommendations)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
