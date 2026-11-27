import 'dart:convert';

import 'package:echotube_flutter/data/database_helper.dart';
import 'package:echotube_flutter/models/song.dart';
import 'package:echotube_flutter/services/jiosaavn_service.dart';
import 'package:echotube_flutter/services/youtube_playlist_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();

  group('Song model', () {
    test('computeKey normalizes title and artist', () {
      expect(
        Song.computeKey('  Love Me Not ', ' Ravyn Lenae '),
        'love me not::ravyn lenae',
      );
    });

    test('fromCatalogJson and toCloudJson round-trip key fields', () {
      final song = Song.fromCatalogJson({
        'Title': 'Dooron Dooron',
        'Artist': 'Paresh Pahuja',
        'Mood': 'Happy',
        'Genre': 'Pop',
        'Category': 'Happy',
        'isNew': false,
      });

      expect(song.songKey, 'dooron dooron::paresh pahuja');
      expect(song.category, 'Happy');
      expect(song.isDownloaded, isFalse);

      final cloud = song.toCloudJson();
      expect(cloud['Title'], 'Dooron Dooron');
      expect(cloud['Category'], 'Happy');
      expect(cloud.containsKey('apiId'), isFalse);
    });
  });

  group('DatabaseHelper offline SQLite', () {
    late Database db;
    late DatabaseHelper helper;

    setUp(() async {
      db = await databaseFactoryFfi.openDatabase(inMemoryDatabasePath);
      await DatabaseHelper.createSchema(db);
      helper = DatabaseHelper.forTesting(db);
    });

    tearDown(() async {
      await db.close();
    });

    test('seeds catalog, tracks likes, downloads, plays, and pending sync', () async {
      final catalog = jsonEncode([
        {
          'Title': 'Love Me Not',
          'Artist': 'Ravyn Lenae',
          'Mood': 'Smooth',
          'Genre': 'R&B',
          'Category': 'Lonely',
          'isNew': false,
        },
        {
          'Title': 'Espresso',
          'Artist': 'Sabrina Carpenter',
          'Mood': 'Upbeat',
          'Genre': 'Synth-Pop',
          'Category': 'Enjoyment',
          'isNew': false,
        },
      ]);

      await helper.seedFromAssetJson(catalog);
      var all = await helper.getAllSongs();
      expect(all.length, 2);

      // Re-seeding does not overwrite existing rows or user edits.
      await helper.toggleLike('love me not::ravyn lenae', true);
      await helper.setLocalAudioPath(
        'love me not::ravyn lenae',
        '/tmp/love_me_not.m4a',
      );
      await helper.recordPlay('love me not::ravyn lenae');
      await helper.seedFromAssetJson(catalog);

      all = await helper.getAllSongs();
      final loved = all.firstWhere((s) => s.songKey == 'love me not::ravyn lenae');
      expect(loved.isLiked, isTrue);
      expect(loved.isDownloaded, isTrue);
      expect(loved.playCount, 1);
      expect(loved.lastPlayedAt, isNotNull);

      // Custom pending sync song + removal.
      final custom = Song(
        songKey: Song.computeKey('Choo Lo', 'The Local Train'),
        title: 'Choo Lo',
        artist: 'The Local Train',
        mood: 'Nostalgic',
        genre: 'Indie Rock',
        category: 'Lonely',
        isCustom: true,
        pendingSync: true,
        createdAt: 1000,
      );
      await helper.upsertSong(custom);

      final pending = await helper.getPendingSyncSongs();
      expect(pending.length, 1);
      expect(pending.first.title, 'Choo Lo');

      await helper.markSynced(custom.songKey);
      expect(await helper.getPendingSyncSongs(), isEmpty);

      await helper.markRemoved(custom.songKey, true);
      final visible = await helper.getAllSongs();
      expect(visible.any((s) => s.songKey == custom.songKey), isFalse);

      final topArtists = await helper.getTopArtists();
      expect(topArtists.isNotEmpty, isTrue);
    });
  });

  group('JioSaavnTrack quality selection', () {
    test('selects 320kbps for high, 160kbps for balanced, 96kbps for saver', () {
      const track = JioSaavnTrack(
        id: '123',
        title: 'Test Track',
        artist: 'Test Artist',
        imageUrl: null,
        language: 'english',
        downloadUrls: [
          (bitrate: 96, url: 'https://example.com/96.mp4'),
          (bitrate: 320, url: 'https://example.com/320.mp4'),
          (bitrate: 160, url: 'https://example.com/160.mp4'),
        ],
      );

      expect(track.bestUrlForQuality(AudioQuality.high), 'https://example.com/320.mp4');
      expect(track.bestUrlForQuality(AudioQuality.balanced), 'https://example.com/160.mp4');
      expect(track.bestUrlForQuality(AudioQuality.saver), 'https://example.com/96.mp4');
    });
  });

  group('YouTubePlaylistService', () {
    test('extractPlaylistId parses URLs and raw IDs', () {
      expect(
        YouTubePlaylistService.extractPlaylistId(
          'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
        ),
        'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
      );
      expect(
        YouTubePlaylistService.extractPlaylistId(
          'https://music.youtube.com/watch?v=abc123&list=OLAK5uy_k1234567890',
        ),
        'OLAK5uy_k1234567890',
      );
      expect(YouTubePlaylistService.extractPlaylistId('invalid'), isNull);
    });

    test('parses ytInitialData and detects duplicates against existing library', () {
      const html = '''
      <html><script>var ytInitialData = {"contents":{"playlistVideoRenderer":{"videoId":"v1","title":{"runs":[{"text":"The Local Train - Choo Lo (Official Video)"}]},"shortBylineText":{"runs":[{"text":"The Local Train - Topic"}]}}},"extra":{"playlistVideoRenderer":{"videoId":"v2","title":{"runs":[{"text":"New Song (Lyrics)"}]},"shortBylineText":{"runs":[{"text":"Indie Artist"}]}}}}; </script></html>
      ''';

      final parsed = YouTubePlaylistService.parsePlaylistTracksFromHtml(html);
      expect(parsed.length, 2);
      expect(parsed[0].title, 'Choo Lo');
      expect(parsed[0].artist, 'The Local Train');
      expect(parsed[1].title, 'New Song');
      expect(parsed[1].artist, 'Indie Artist');

      final existing = [
        Song(
          songKey: Song.computeKey('Choo Lo', 'The Local Train'),
          title: 'Choo Lo',
          artist: 'The Local Train',
          mood: 'Nostalgic',
          genre: 'Indie Rock',
          category: 'Lonely',
          createdAt: 1000,
        ),
      ];

      expect(
        YouTubePlaylistService.isDuplicateTrack(parsed[0], existing),
        isTrue,
      );
      expect(
        YouTubePlaylistService.isDuplicateTrack(parsed[1], existing),
        isFalse,
      );
    });
  });
}
