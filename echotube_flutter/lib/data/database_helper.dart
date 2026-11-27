import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../models/song.dart';

class DatabaseHelper {
  DatabaseHelper._init();

  DatabaseHelper.forTesting(Database db) : _database = db;

  static final DatabaseHelper instance = DatabaseHelper._init();

  static const String _dbName = 'echotube.db';
  static const int _dbVersion = 1;
  static const String songsTable = 'songs';

  Database? _database;

  Future<Database> get database async {
    final existing = _database;
    if (existing != null && existing.isOpen) {
      return existing;
    }
    _database = await _initDb();
    return _database!;
  }

  Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, _dbName);
    return openDatabase(
      path,
      version: _dbVersion,
      onCreate: (db, version) => createSchema(db),
    );
  }

  static Future<void> createSchema(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS $songsTable (
        song_key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        mood TEXT,
        genre TEXT,
        category TEXT NOT NULL,
        image_url TEXT,
        stream_url TEXT,
        local_audio_path TEXT,
        api_id TEXT,
        is_new INTEGER NOT NULL DEFAULT 0,
        is_custom INTEGER NOT NULL DEFAULT 0,
        is_removed INTEGER NOT NULL DEFAULT 0,
        is_liked INTEGER NOT NULL DEFAULT 0,
        play_count INTEGER NOT NULL DEFAULT 0,
        last_played_at INTEGER,
        created_at INTEGER NOT NULL,
        pending_sync INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_songs_category ON $songsTable (category)',
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_songs_is_liked ON $songsTable (is_liked)',
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_songs_last_played_at ON $songsTable (last_played_at)',
    );
  }

  Future<void> seedFromAssetJson(String jsonString) async {
    final db = await database;
    final countResult = await db.rawQuery('SELECT COUNT(*) FROM $songsTable');
    final existingCount = Sqflite.firstIntValue(countResult) ?? 0;
    if (existingCount > 0) {
      return;
    }

    final decoded = jsonDecode(jsonString);
    if (decoded is! List) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    final batch = db.batch();
    for (var i = 0; i < decoded.length; i++) {
      final item = decoded[i];
      if (item is! Map<String, dynamic>) continue;
      final song = Song.fromCatalogJson(item).copyWith(createdAt: now + i);
      batch.insert(
        songsTable,
        song.toDbMap(),
        conflictAlgorithm: ConflictAlgorithm.ignore,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<Song>> getAllSongs({bool includeRemoved = false}) async {
    final db = await database;
    final rows = await db.query(
      songsTable,
      where: includeRemoved ? null : 'is_removed = 0',
      orderBy:
          'is_custom DESC, CASE WHEN is_custom = 1 THEN -created_at ELSE created_at END ASC',
    );
    return rows.map(Song.fromDbMap).toList();
  }

  Future<void> upsertSong(Song song) async {
    final db = await database;
    await db.insert(
      songsTable,
      song.toDbMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> upsertSongs(List<Song> songs) async {
    if (songs.isEmpty) return;
    final db = await database;
    final batch = db.batch();
    for (final song in songs) {
      batch.insert(
        songsTable,
        song.toDbMap(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<void> updateStreamAndImage(
    String songKey, {
    String? streamUrl,
    String? imageUrl,
    String? apiId,
  }) async {
    final updates = <String, Object?>{};
    if (streamUrl != null) updates['stream_url'] = streamUrl;
    if (imageUrl != null) updates['image_url'] = imageUrl;
    if (apiId != null) updates['api_id'] = apiId;
    if (updates.isEmpty) return;

    final db = await database;
    await db.update(
      songsTable,
      updates,
      where: 'song_key = ?',
      whereArgs: [songKey],
    );
  }

  Future<void> setLocalAudioPath(String songKey, String? path) async {
    final db = await database;
    await db.update(
      songsTable,
      {'local_audio_path': path},
      where: 'song_key = ?',
      whereArgs: [songKey],
    );
  }

  Future<void> toggleLike(String songKey, bool isLiked) async {
    final db = await database;
    await db.update(
      songsTable,
      {'is_liked': isLiked ? 1 : 0},
      where: 'song_key = ?',
      whereArgs: [songKey],
    );
  }

  Future<void> markRemoved(String songKey, bool removed) async {
    final db = await database;
    await db.update(
      songsTable,
      {'is_removed': removed ? 1 : 0},
      where: 'song_key = ?',
      whereArgs: [songKey],
    );
  }

  Future<void> recordPlay(String songKey) async {
    final db = await database;
    final now = DateTime.now().millisecondsSinceEpoch;
    await db.rawUpdate(
      '''
      UPDATE $songsTable
      SET play_count = play_count + 1,
          last_played_at = ?
      WHERE song_key = ?
      ''',
      [now, songKey],
    );
  }

  Future<List<Song>> getPendingSyncSongs() async {
    final db = await database;
    final rows = await db.query(
      songsTable,
      where: 'pending_sync = 1',
      orderBy: 'created_at ASC',
    );
    return rows.map(Song.fromDbMap).toList();
  }

  Future<void> markSynced(String songKey) async {
    final db = await database;
    await db.update(
      songsTable,
      {'pending_sync': 0},
      where: 'song_key = ?',
      whereArgs: [songKey],
    );
  }

  Future<List<MapEntry<String, int>>> getTopArtists({int limit = 6}) async {
    final db = await database;
    final rows = await db.query(
      songsTable,
      columns: ['artist'],
      where: 'is_removed = 0',
    );
    return _countTopValues(
      rows.map((row) => row['artist'] as String? ?? ''),
      limit: limit,
      splitComma: true,
    );
  }

  Future<List<MapEntry<String, int>>> getTopGenres({int limit = 6}) async {
    final db = await database;
    final rows = await db.query(
      songsTable,
      columns: ['genre'],
      where: 'is_removed = 0',
    );
    return _countTopValues(
      rows.map((row) => row['genre'] as String? ?? ''),
      limit: limit,
      splitComma: false,
    );
  }

  List<MapEntry<String, int>> _countTopValues(
    Iterable<String> rawValues, {
    required int limit,
    required bool splitComma,
  }) {
    if (limit <= 0) return const [];
    final counts = <String, int>{};
    for (final raw in rawValues) {
      final parts = splitComma ? raw.split(',') : [raw];
      for (final part in parts) {
        final normalized = part.trim();
        if (normalized.isEmpty) continue;
        counts[normalized] = (counts[normalized] ?? 0) + 1;
      }
    }
    final sorted = counts.entries.toList()
      ..sort((a, b) {
        final byCount = b.value.compareTo(a.value);
        return byCount != 0 ? byCount : a.key.compareTo(b.key);
      });
    return sorted.take(limit).toList();
  }
}
