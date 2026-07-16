import pandas as pd
import json
import os
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

# Load songs from Excel
df = pd.read_excel('Top100Songs_Filled.xlsx')
# Only take rows that have Title to avoid NaN
df = df.dropna(subset=['Title'])
songs = df[['Title', 'Artist', 'Mood', 'Genre']].to_dict(orient='records')

LABELS_FILE = 'labels.json'
if os.path.exists(LABELS_FILE):
    with open(LABELS_FILE, 'r') as f:
        labels = json.load(f)
else:
    labels = {}

@app.route('/')
def index():
    # Find next unlabelled song
    next_song = None
    for song in songs:
        if str(song['Title']) not in labels:
            next_song = song
            break
            
    if not next_song:
        next_song = {
            'Title': 'All spreadsheet songs labeled!',
            'Artist': 'Use the search bar above to add your own custom songs.',
            'Genre': '',
            'Mood': ''
        }
    html = """
    <html>
    <head>
        <title>Train EchoTube ML Model</title>
        <style>
            body { font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #111318; margin: 0; color: #e2e2e9; }
            .card { background: #1e2025; padding: 40px; border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); text-align: center; max-width: 600px; width: 100%; border: 1px solid #33353a; display: flex; flex-direction: column; max-height: 90vh; overflow-y: auto; }
            h1 { color: #8aebff; margin-bottom: 8px; font-size: 28px; }
            p { color: #bbc9cd; margin-bottom: 24px; font-size: 16px; }
            .btn-group { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
            .btn { border: none; padding: 16px 32px; font-size: 16px; font-weight: 600; border-radius: 12px; cursor: pointer; color: white; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
            .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
            .btn-happy { background: #eab308; color: #000; }
            .btn-lonely { background: #3b82f6; }
            .btn-enjoy { background: #ec4899; }
            .btn-skip { background: #33353a; color: #e2e2e9; }
            .count { margin-top: 16px; color: #888; font-size: 14px; font-weight: 500; }
            .badge { display: inline-block; background: rgba(34, 211, 238, 0.1); padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; margin: 0 4px; color: #22d3ee; }
            audio { width: 100%; margin-bottom: 24px; outline: none; border-radius: 30px; }
            
            .search-box { display: flex; gap: 8px; margin-bottom: 16px; }
            .search-box input { flex: 1; padding: 12px 16px; border-radius: 8px; border: 1px solid #33353a; background: #111318; color: #e2e2e9; outline: none; }
            .search-box button { background: #3b82f6; color: white; border: none; padding: 0 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
            #searchResults { background: #111318; border: 1px solid #33353a; border-radius: 8px; text-align: left; max-height: 200px; overflow-y: auto; margin-bottom: 24px; display: none; }
            .result-item { padding: 12px; border-bottom: 1px solid #33353a; cursor: pointer; }
            .result-item:hover { background: #1e2025; }
        </style>
    </head>
    <body>
        <div class="card">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #bbc9cd; margin-bottom: 12px;">Train Your Music Taste</div>
            
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Search to label your own song..." onkeydown="if(event.key === 'Enter') searchNewSong()" />
                <button onclick="searchNewSong()">Search</button>
            </div>
            <div id="searchResults"></div>

            <h1 id="song-title">{{ song.Title }}</h1>
            <p id="song-artist">{{ song.Artist }}</p>
            
            <div style="margin-bottom: 24px;" id="badges">
                <span class="badge">{{ song.Genre }}</span>
                <span class="badge">{{ song.Mood }}</span>
            </div>
            
            <audio id="player" controls autoplay></audio>
            <div id="status" style="color: #ef4444; font-size: 14px; margin-bottom: 16px;"></div>

            <div class="btn-group">
                <button class="btn btn-happy" onclick="label('Happy')">Happy</button>
                <button class="btn btn-lonely" onclick="label('Lonely')">Lonely</button>
                <button class="btn btn-enjoy" onclick="label('Enjoyment')">Enjoyment</button>
                <button class="btn btn-skip" onclick="label('Skip')">Remove / Skip</button>
            </div>
            
            <div class="count">Labeled: {{ count }} / {{ total }} spreadsheet songs</div>
        </div>
        
        <script>
            let songTitle = {{ song.Title | tojson | safe }};
            let songArtist = {{ song.Artist | tojson | safe }};
            let songImage = "";
            let songStreamUrl = "";
            let isCustomSong = false;

            async function searchNewSong() {
                const q = document.getElementById('searchInput').value;
                if(!q) return;
                const res = await fetch(`https://jio-blue.vercel.app/api/search/songs?query=${encodeURIComponent(q)}`);
                const data = await res.json();
                const results = data.data && data.data.results;
                if(results) {
                    const html = results.map(r => {
                        const url = (r.downloadUrl.find(u=>u.quality==='320kbps') || r.downloadUrl[0]).url;
                        const img = (r.image.find(i=>i.quality==='500x500') || r.image[0]).url;
                        const safeName = r.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeArtist = r.primaryArtists.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        return `<div class="result-item" onclick="selectSearchedSong('${safeName}', '${safeArtist}', '${url}', '${img}')">
                            <div style="font-size: 14px; font-weight: bold;">${r.name}</div>
                            <div style="font-size: 12px; color: #888;">${r.primaryArtists}</div>
                        </div>`;
                    }).join('');
                    const container = document.getElementById('searchResults');
                    container.innerHTML = html;
                    container.style.display = 'block';
                }
            }

            function selectSearchedSong(name, artist, url, img) {
                // Decode HTML entities if present
                const txt = document.createElement('textarea');
                txt.innerHTML = name;
                songTitle = txt.value;
                txt.innerHTML = artist;
                songArtist = txt.value;
                songImage = img;
                songStreamUrl = url;
                isCustomSong = true;

                document.getElementById('song-title').innerText = songTitle;
                document.getElementById('song-artist').innerText = songArtist;
                document.getElementById('player').src = url;
                document.getElementById('player').play();
                document.getElementById('searchResults').style.display = 'none';
                document.getElementById('searchInput').value = '';
                document.getElementById('badges').style.display = 'none';
                document.getElementById('status').innerText = '';
            }

            async function loadAudio() {
                try {
                    let query = encodeURIComponent(songTitle + ' ' + songArtist);
                    let res = await fetch(`https://jio-blue.vercel.app/api/search/songs?query=${query}`);
                    let data = await res.json();
                    let results = data.data && data.data.results;
                    
                    if (!results || results.length === 0) {
                        query = encodeURIComponent(songTitle);
                        res = await fetch(`https://jio-blue.vercel.app/api/search/songs?query=${query}`);
                        data = await res.json();
                        results = data.data && data.data.results;
                    }
                    
                    if (results && results.length > 0) {
                        const track = results[0];
                        const downloadUrl = track.downloadUrl.find(url => url.quality === '320kbps') || track.downloadUrl[0];
                        const audio = document.getElementById('player');
                        audio.src = downloadUrl.url;
                    } else {
                        document.getElementById('status').innerText = 'Audio preview not available on JioSaavn.';
                    }
                } catch(e) {
                    console.error(e);
                    document.getElementById('status').innerText = 'Error loading audio preview.';
                }
            }
            loadAudio();

            function label(category) {
                fetch('/label', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        title: songTitle, 
                        artist: songArtist,
                        category: category,
                        image: songImage,
                        streamUrl: songStreamUrl,
                        isCustom: isCustomSong
                    })
                }).then(() => window.location.reload());
            }
        </script>
    </body>
    </html>
    """
    # Replace NaN with empty strings
    for k in next_song:
        if pd.isna(next_song[k]):
            next_song[k] = ""
            
    return render_template_string(html, song=next_song, count=len(labels), total=len(songs))

@app.route('/label', methods=['POST'])
def save_label():
    data = request.json
    labels[data['title']] = data['category']
    with open(LABELS_FILE, 'w') as f:
        json.dump(labels, f)
        
    if data.get('isCustom'):
        custom_file = 'custom_labeled_songs.json'
        if os.path.exists(custom_file):
            with open(custom_file, 'r') as f:
                custom_songs = json.load(f)
        else:
            custom_songs = []
            
        custom_songs.append({
            'Title': data['title'],
            'Artist': data['artist'],
            'Category': data['category'],
            'image': data.get('image'),
            'streamUrl': data.get('streamUrl'),
            'Mood': 'Custom',
            'Genre': 'Custom',
            'isNew': False
        })
        with open(custom_file, 'w') as f:
            json.dump(custom_songs, f)
            
    return jsonify({"success": True})

if __name__ == '__main__':
    print("Starting label server on http://127.0.0.1:5000")
    app.run(port=5000)
