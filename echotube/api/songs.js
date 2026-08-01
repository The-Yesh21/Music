import { createClient } from '@supabase/supabase-js';

// Server-side only. Set these in the Vercel dashboard (Project → Settings → Environment Variables):
//   SUPABASE_URL          e.g. https://xyzcompany.supabase.co
//   SUPABASE_SECRET_KEY   the secret key from Supabase → Settings → API (new-style key).
//                         Older projects may expose SUPABASE_SERVICE_ROLE_KEY instead —
//                         this function falls back to that name automatically.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Add them under Vercel → Project → Settings → Environment Variables, then redeploy.'
  );
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false },
});

const VALID_CATEGORIES = ['Happy', 'Lonely', 'Enjoyment'];

function songKey(song) {
  return `${String(song.Title || '').trim().toLowerCase()}::${String(song.Artist || '').trim().toLowerCase()}`;
}

function toSong(body) {
  return {
    Title: String(body.Title || '').trim(),
    Artist: String(body.Artist || '').trim(),
    Category: String(body.Category || '').trim(),
    Mood: body.Mood || 'Custom',
    Genre: body.Genre || 'Custom',
    image: body.image || null,
    streamUrl: body.streamUrl || null,
    isNew: false,
    ...(body.apiId ? { apiId: body.apiId } : {}),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET /api/songs → { success: true, songs: [...] }
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('songs')
      .select('data')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, songs: (data || []).map(r => r.data) });
  }

  // POST /api/songs → add a song (deduped by Title::Artist).
  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.Title || !body.Category) {
      return res.status(400).json({ success: false, error: 'Title and Category are required' });
    }
    if (!VALID_CATEGORIES.includes(body.Category)) {
      return res.status(400).json({ success: false, error: 'Invalid category' });
    }

    const song = toSong(body);
    const key = songKey(song);

    const { data: existing } = await supabase.from('songs').select('data');
    const alreadyExists = (existing || []).some(r => songKey(r.data) === key);

    if (!alreadyExists) {
      const { error } = await supabase.from('songs').insert({
        title: song.Title,
        artist: song.Artist,
        category: song.Category,
        data: song,
      });
      // 23505 = unique constraint violation from a concurrent duplicate add —
      // treat it as a successful dedupe instead of an error.
      if (error && error.code !== '23505') {
        return res.status(500).json({ success: false, error: error.message });
      }
    }

    return res.status(200).json({ success: true, song });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
