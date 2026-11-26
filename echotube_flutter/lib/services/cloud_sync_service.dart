import 'dart:convert';

import 'package:http/http.dart' as http;

import '../data/database_helper.dart';
import '../models/song.dart';

class CloudSyncService {
  static const String cloudApiUrl = 'https://music-53zs.vercel.app/api/songs';
  static const Duration _timeout = Duration(seconds: 15);

  static final CloudSyncService instance = CloudSyncService._();

  CloudSyncService._();

  Future<List<Song>> fetchCloudSongs() async {
    try {
      final response =
          await http.get(Uri.parse(cloudApiUrl)).timeout(_timeout);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return const [];
      }

      final decoded = jsonDecode(response.body);
      List<dynamic>? rawSongs;
      if (decoded is Map<String, dynamic> && decoded['songs'] is List) {
        rawSongs = decoded['songs'] as List<dynamic>;
      } else if (decoded is List) {
        rawSongs = decoded;
      }

      if (rawSongs == null) return const [];

      final songs = <Song>[];
      for (final item in rawSongs) {
        if (item is! Map<String, dynamic>) continue;
        final title = (item['Title'] ?? '').toString().trim();
        final category = (item['Category'] ?? '').toString().trim();
        if (title.isEmpty || !kCategories.contains(category)) continue;
        songs.add(Song.fromCatalogJson(item));
      }
      return songs;
    } catch (_) {
      return const [];
    }
  }

  Future<bool> pushSongToCloud(Song song) async {
    try {
      final response = await http
          .post(
            Uri.parse(cloudApiUrl),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode(song.toCloudJson()),
          )
          .timeout(_timeout);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return false;
      }

      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic> && decoded['success'] == false) {
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> syncWithDatabase(DatabaseHelper db) async {
    // 1. Push any locally queued songs that have not been synced yet.
    final pendingSongs = await db.getPendingSyncSongs();
    for (final song in pendingSongs) {
      final ok = await pushSongToCloud(song);
      if (ok) {
        await db.markSynced(song.songKey);
      }
    }

    // 2. Pull cloud catalog and merge into local SQLite without clobbering
    // local user state (isLiked, isRemoved, localAudioPath, playCount).
    final cloudSongs = await fetchCloudSongs();
    if (cloudSongs.isEmpty) return;

    final existingSongs = await db.getAllSongs(includeRemoved: true);
    final existingByKey = <String, Song>{
      for (final song in existingSongs) song.songKey: song,
    };

    final toUpsert = <Song>[];
    for (final cloudSong in cloudSongs) {
      final existing = existingByKey[cloudSong.songKey];
      if (existing == null) {
        toUpsert.add(cloudSong);
        continue;
      }

      final existingImage = existing.imageUrl;
      final cloudImage = cloudSong.imageUrl;
      final needsImage = (existingImage == null || existingImage.isEmpty) &&
          (cloudImage != null && cloudImage.isNotEmpty);

      final existingStream = existing.streamUrl;
      final cloudStream = cloudSong.streamUrl;
      final needsStream = (existingStream == null || existingStream.isEmpty) &&
          (cloudStream != null && cloudStream.isNotEmpty);

      if (needsImage || needsStream) {
        toUpsert.add(
          existing.copyWith(
            imageUrl: needsImage ? cloudImage : existingImage,
            streamUrl: needsStream ? cloudStream : existingStream,
          ),
        );
      }
    }

    if (toUpsert.isNotEmpty) {
      await db.upsertSongs(toUpsert);
    }
  }
}
