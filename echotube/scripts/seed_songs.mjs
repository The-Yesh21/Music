// One-time seed: uploads echotube/src/categorized_songs.json into the Supabase `songs` table.
//
// Setup:
//   1. Create a Supabase project (free tier) and run this SQL in the SQL editor:
//        create table if not exists public.songs (
//          id uuid primary key default gen_random_uuid(),
//          title text not null,
//          artist text not null default '',
//          category text not null default '',
//          data jsonb not null,
//          created_at timestamptz not null default now()
//        );
//        create index if not exists songs_title_artist_idx on public.songs (title, artist);
//        -- Optional guard so two rapid adds of the same song can never duplicate:
//        create unique index if not exists songs_title_artist_uq on public.songs (lower(title), lower(artist));
//   2. Create echotube/.env with:
//        SUPABASE_URL=https://<your-project>.supabase.co
//        SUPABASE_SECRET_KEY=<secret key from Supabase → Settings → API>
//      (older projects may call it SUPABASE_SERVICE_ROLE_KEY — that name also works)
//   3. Run: npm run seed   (from the echotube folder)
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tiny .env loader (no extra dependency needed).
const envPath = path.join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY.');
  console.error('Create echotube/.env with those two values (see header comments in this file).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const songKey = song => `${String(song.Title || '').trim().toLowerCase()}::${String(song.Artist || '').trim().toLowerCase()}`;

const songsPath = path.join(__dirname, '..', 'src', 'categorized_songs.json');
const songs = JSON.parse(readFileSync(songsPath, 'utf8'));

const { data: existing, error: fetchErr } = await supabase.from('songs').select('data');
if (fetchErr) {
  console.error('Failed to fetch existing songs:', fetchErr.message);
  process.exit(1);
}

const existingKeys = new Set((existing || []).map(r => songKey(r.data)));

const rows = songs
  .filter(s => !existingKeys.has(songKey(s)))
  .map(song => ({
    title: String(song.Title || '').trim(),
    artist: String(song.Artist || '').trim(),
    category: song.Category || '',
    data: song,
  }));

if (rows.length === 0) {
  console.log(`All ${songs.length} songs are already in Supabase. Nothing to seed.`);
  process.exit(0);
}

// Insert in batches of 100 to stay under request limits.
for (let i = 0; i < rows.length; i += 100) {
  const batch = rows.slice(i, i + 100);
  const { error } = await supabase.from('songs').insert(batch);
  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
}

console.log(`Seeded ${rows.length} songs to Supabase (${songs.length} total in file).`);
