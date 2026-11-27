import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/database_helper.dart';
import '../models/song.dart';
import '../services/audio_player_service.dart';
import '../services/cloud_sync_service.dart';
import '../services/jiosaavn_service.dart';
import '../services/offline_download_service.dart';
import '../theme/spotify_theme.dart';

String audioQualityLabel(AudioQuality quality) {
  final name = quality.name.toLowerCase();
  if (name.contains('320') || name.contains('high')) return '320 kbps';
  if (name.contains('160') || name.contains('med')) return '160 kbps';
  if (name.contains('96') || name.contains('low')) return '96 kbps';
  return quality.name;
}

class AppController extends ChangeNotifier {
  AppController({
    required this.db,
    required this.audioHandler,
  });

  final DatabaseHelper db;
  final EchoTubeAudioHandler audioHandler;

  List<Song> _songs = const [];
  bool _isLoading = true;
  bool _isSyncing = false;
  bool _isBatterySaver = false;
  bool _isDarkMode = true;
  static const String _darkModePrefKey = 'echotube_dark_mode';
  final Map<String, double> _downloadProgress = {};
  List<String> _topArtists = const [];
  List<String> _topGenres = const [];

  List<Song> get songs => _songs;
  bool get isLoading => _isLoading;
  bool get isSyncing => _isSyncing;
  bool get isBatterySaver => _isBatterySaver;
  bool get isDarkMode => _isDarkMode;
  Map<String, double> get downloadProgress => Map.unmodifiable(_downloadProgress);
  List<String> get topArtists => _topArtists;
  List<String> get topGenres => _topGenres;

  List<Song> get likedSongs =>
      _songs.where((s) => !s.isRemoved && s.isLiked).toList();

  List<Song> get downloadedSongs =>
      _songs.where((s) => !s.isRemoved && s.isDownloaded).toList();

  List<Song> get newlyAddedSongs {
    final added = _songs
        .where((s) => !s.isRemoved && (s.isCustom || s.isNew))
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return added.take(20).toList();
  }

  List<Song> get recentlyPlayed {
    final played = _songs
        .where((s) => !s.isRemoved && s.lastPlayedAt != null)
        .toList()
      ..sort((a, b) => b.lastPlayedAt!.compareTo(a.lastPlayedAt!));
    return played.take(12).toList();
  }

  List<Song> get mostPlayed {
    final played = _songs
        .where((s) => !s.isRemoved && s.playCount > 0)
        .toList()
      ..sort((a, b) => b.playCount.compareTo(a.playCount));
    return played.take(15).toList();
  }

  List<Song> songsForCategory(String cat) {
    final normalized = cat.trim().toLowerCase();
    return _songs
        .where(
          (s) => !s.isRemoved && s.category.trim().toLowerCase() == normalized,
        )
        .toList();
  }

  Future<void> init() async {
    _isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      _isDarkMode = prefs.getBool(_darkModePrefKey) ?? true;
      SpotifyColors.setDarkMode(_isDarkMode);

      await _reloadFromDb();
      if (_songs.isEmpty) {
        final rawJson =
            await rootBundle.loadString('assets/categorized_songs.json');
        await db.seedFromAssetJson(rawJson);
        await _reloadFromDb();
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }

    unawaited(syncNow());
  }

  Future<void> _reloadFromDb() async {
    final loaded = await db.getAllSongs();
    final artists = await db.getTopArtists();
    final genres = await db.getTopGenres();
    _songs = loaded.where((s) => !s.isRemoved).toList();
    _topArtists = artists.map((e) => e.key).toList();
    _topGenres = genres.map((e) => e.key).toList();
  }

  Future<void> syncNow() async {
    if (_isSyncing) return;
    _isSyncing = true;
    notifyListeners();
    try {
      await CloudSyncService.instance.syncWithDatabase(db);
      await _reloadFromDb();
    } catch (_) {
      // Keep local library usable when offline or sync fails.
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  Future<void> playSong(Song song, {List<Song>? queue}) async {
    final targetQueue =
        (queue != null && queue.isNotEmpty) ? queue : <Song>[song];
    await audioHandler.playSong(song, contextQueue: targetQueue);

    final updated = song.copyWith(
      playCount: song.playCount + 1,
      lastPlayedAt: DateTime.now().millisecondsSinceEpoch,
    );
    await db.upsertSong(updated);
    await _reloadFromDb();
    notifyListeners();
  }

  Future<void> playCategory(String category, {bool shuffle = false}) async {
    final list = List<Song>.from(songsForCategory(category));
    if (list.isEmpty) return;
    await audioHandler.playQueue(list, shuffle: shuffle);
    await _reloadFromDb();
    notifyListeners();
  }

  Future<void> playLiked({bool shuffle = false}) async {
    final list = List<Song>.from(likedSongs);
    if (list.isEmpty) return;
    await audioHandler.playQueue(list, shuffle: shuffle);
    await _reloadFromDb();
    notifyListeners();
  }

  Future<void> playDownloaded({bool shuffle = false}) async {
    final list = List<Song>.from(downloadedSongs);
    if (list.isEmpty) return;
    await audioHandler.playQueue(list, shuffle: shuffle);
    await _reloadFromDb();
    notifyListeners();
  }

  Future<void> playSongsList(List<Song> list, {bool shuffle = false}) async {
    final copy = List<Song>.from(list);
    if (copy.isEmpty) return;
    await audioHandler.playQueue(copy, shuffle: shuffle);
    await _reloadFromDb();
    notifyListeners();
  }

  Future<void> toggleLike(Song song) async {
    final newLiked = !song.isLiked;
    await db.toggleLike(song.songKey, newLiked);
    final updated = song.copyWith(isLiked: newLiked);
    _songs = _songs
        .map((s) => s.songKey == song.songKey ? updated : s)
        .toList();
    if (audioHandler.currentSongNotifier.value?.songKey == song.songKey) {
      audioHandler.currentSongNotifier.value = updated;
    }
    notifyListeners();
  }

  Future<void> removeSong(Song song) async {
    await db.markRemoved(song.songKey, true);
    _songs = _songs.where((s) => s.songKey != song.songKey).toList();
    notifyListeners();
  }

  Future<Song> addSearchTrackToCategory(
    JioSaavnTrack track,
    String category,
  ) async {
    final song = track.toSong(category).copyWith(
          isCustom: true,
          isNew: true,
          pendingSync: true,
          createdAt: DateTime.now().millisecondsSinceEpoch,
        );
    await db.upsertSong(song);
    await _reloadFromDb();
    notifyListeners();
    unawaited(CloudSyncService.instance.pushSongToCloud(song));
    return song;
  }

  Future<void> downloadSong(Song song) async {
    if (_downloadProgress.containsKey(song.songKey)) return;
    _downloadProgress[song.songKey] = 0.0;
    notifyListeners();

    try {
      await OfflineDownloadService.instance.downloadSong(
        song,
        db,
        quality: audioHandler.qualityNotifier.value,
        onProgress: (progress) {
          _downloadProgress[song.songKey] = progress.clamp(0.0, 1.0);
          notifyListeners();
        },
      );
      await _reloadFromDb();
    } finally {
      _downloadProgress.remove(song.songKey);
      notifyListeners();
    }
  }

  Future<void> deleteDownload(Song song) async {
    await OfflineDownloadService.instance.deleteDownload(song, db);
    await _reloadFromDb();
    notifyListeners();
  }

  Future<void> setAudioQuality(AudioQuality quality) async {
    await audioHandler.setQuality(quality);
    notifyListeners();
  }

  void toggleBatterySaver() {
    _isBatterySaver = !_isBatterySaver;
    notifyListeners();
  }

  Future<void> toggleTheme() async {
    _isDarkMode = !_isDarkMode;
    SpotifyColors.setDarkMode(_isDarkMode);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_darkModePrefKey, _isDarkMode);
  }
}
