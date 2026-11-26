import 'dart:async';
import 'dart:collection';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/song.dart';

class JioSaavnTrack {
  final String id;
  final String title;
  final String artist;
  final String? imageUrl;
  final List<({int bitrate, String url})> downloadUrls;
  final String language;

  const JioSaavnTrack({
    required this.id,
    required this.title,
    required this.artist,
    required this.imageUrl,
    required this.downloadUrls,
    required this.language,
  });

  factory JioSaavnTrack.fromJson(Map<String, dynamic> json) {
    final rawTitle = (json['name'] ?? json['title'] ?? 'Unknown').toString();
    final title = _decodeHtmlEntities(rawTitle).trim();
    final artist = _decodeHtmlEntities(_extractArtists(json)).trim();
    final imageUrl = _extractBestImage(json['image']);
    final downloadUrls = _extractDownloadUrls(json['downloadUrl']);
    final language = (json['language'] ?? '').toString().trim();

    return JioSaavnTrack(
      id: (json['id'] ?? '').toString(),
      title: title.isEmpty ? 'Unknown' : title,
      artist: artist.isEmpty ? 'Unknown artist' : artist,
      imageUrl: imageUrl,
      downloadUrls: downloadUrls,
      language: language,
    );
  }

  /// Selects the best stream URL for the requested [quality].
  ///
  /// Sorts [downloadUrls] by bitrate descending:
  /// - [AudioQuality.high]: highest >= 320 or highest available.
  /// - [AudioQuality.balanced]: closest <= 160 or lowest available.
  /// - [AudioQuality.saver]: closest <= 96 or lowest available.
  String? bestUrlForQuality(AudioQuality quality) {
    if (downloadUrls.isEmpty) return null;

    final sorted = List<({int bitrate, String url})>.from(downloadUrls)
      ..sort((a, b) => b.bitrate.compareTo(a.bitrate));

    switch (quality) {
      case AudioQuality.high:
        for (final entry in sorted) {
          if (entry.bitrate >= 320) return entry.url;
        }
        return sorted.first.url;

      case AudioQuality.balanced:
        for (final entry in sorted) {
          if (entry.bitrate <= 160) return entry.url;
        }
        return sorted.last.url;

      case AudioQuality.saver:
        for (final entry in sorted) {
          if (entry.bitrate <= 96) return entry.url;
        }
        return sorted.last.url;
    }
  }

  Song toSong(String category, {AudioQuality quality = AudioQuality.high}) {
    return Song.fromCatalogJson(<String, dynamic>{
      'Title': title,
      'Artist': artist,
      'Category': category,
      'Mood': '',
      'Genre': language,
      'image': imageUrl,
      'streamUrl': bestUrlForQuality(quality),
      'isNew': true,
      'apiId': id,
    });
  }

  static String _extractArtists(Map<String, dynamic> json) {
    final artists = json['artists'];
    if (artists is Map<String, dynamic>) {
      final primary = artists['primary'];
      if (primary is List && primary.isNotEmpty) {
        final names = primary
            .whereType<Map<String, dynamic>>()
            .map((a) => (a['name'] ?? '').toString().trim())
            .where((n) => n.isNotEmpty)
            .toList();
        if (names.isNotEmpty) return names.join(', ');
      }

      final all = artists['all'];
      if (all is List && all.isNotEmpty) {
        final names = all
            .whereType<Map<String, dynamic>>()
            .map((a) => (a['name'] ?? '').toString().trim())
            .where((n) => n.isNotEmpty)
            .toList();
        if (names.isNotEmpty) return names.join(', ');
      }
    }

    final primaryArtists = json['primaryArtists'];
    if (primaryArtists is String && primaryArtists.trim().isNotEmpty) {
      return primaryArtists.trim();
    }

    return 'Unknown artist';
  }

  static String? _extractBestImage(dynamic images) {
    if (images is! List || images.isEmpty) return null;

    String? url500;
    String? url150;
    String? fallback;

    for (final item in images) {
      if (item is! Map<String, dynamic>) continue;
      final url = (item['url'] ?? item['link'] ?? '').toString().trim();
      if (url.isEmpty) continue;
      final quality = (item['quality'] ?? '').toString();
      if (quality == '500x500') {
        url500 = url;
        break;
      } else if (quality == '150x150' && url150 == null) {
        url150 = url;
      } else {
        fallback ??= url;
      }
    }

    return url500 ?? url150 ?? fallback;
  }

  static List<({int bitrate, String url})> _extractDownloadUrls(dynamic raw) {
    if (raw is! List || raw.isEmpty) return const [];

    final result = <({int bitrate, String url})>[];
    for (final item in raw) {
      if (item is! Map<String, dynamic>) continue;
      final url = (item['url'] ?? item['link'] ?? '').toString().trim();
      if (url.isEmpty) continue;
      final qualityStr = (item['quality'] ?? '').toString();
      final digits = qualityStr.replaceAll(RegExp(r'\D'), '');
      final bitrate = int.tryParse(digits) ?? 0;
      result.add((bitrate: bitrate, url: url));
    }
    return result;
  }

  static String _decodeHtmlEntities(String input) {
    return input
        .replaceAll('&quot;', '"')
        .replaceAll('&amp;', '&')
        .replaceAll('&#039;', "'")
        .replaceAll('&apos;', "'")
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>');
  }
}

class JioSaavnService {
  static final JioSaavnService instance = JioSaavnService._();

  JioSaavnService._();

  static const List<String> endpoints = [
    'https://jio-blue.vercel.app/api/search/songs',
    'https://jiosaavn-sigma.vercel.app/api/search/songs',
  ];

  static const int maxConcurrent = 3;
  static const Duration requestTimeout = Duration(seconds: 10);
  static const int maxRetries = 1;
  static const Duration retryDelay = Duration(milliseconds: 600);

  final Map<String, List<JioSaavnTrack>> _cache = {};
  final Map<String, Future<List<JioSaavnTrack>>> _inFlight = {};

  int _activeCount = 0;
  final Queue<Completer<void>> _waiters = Queue<Completer<void>>();

  Future<void> _acquireSlot() {
    if (_activeCount < maxConcurrent) {
      _activeCount += 1;
      return Future<void>.value();
    }
    final completer = Completer<void>();
    _waiters.addLast(completer);
    return completer.future;
  }

  void _releaseSlot() {
    _activeCount = _activeCount > 0 ? _activeCount - 1 : 0;
    if (_waiters.isNotEmpty) {
      final next = _waiters.removeFirst();
      _activeCount += 1;
      next.complete();
    }
  }

  Future<List<JioSaavnTrack>> searchSongs(String query, {int limit = 20}) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return const [];

    final cacheKey = '$trimmed::$limit';
    final cached = _cache[cacheKey];
    if (cached != null) return cached;

    final existing = _inFlight[cacheKey];
    if (existing != null) return existing;

    final future = () async {
      await _acquireSlot();
      try {
        final results = await _runSearch(trimmed, limit);
        if (results.isNotEmpty) {
          _cache[cacheKey] = results;
        }
        return results;
      } finally {
        _releaseSlot();
        _inFlight.remove(cacheKey);
      }
    }();

    _inFlight[cacheKey] = future;
    return future;
  }

  Future<JioSaavnTrack?> resolveTrackForSong(Song song) async {
    final fullQuery = '${song.title} ${song.artist}'.trim();
    if (fullQuery.isNotEmpty) {
      final results = await searchSongs(fullQuery, limit: 5);
      if (results.isNotEmpty) return results.first;
    }

    final titleOnly = song.title.trim();
    if (titleOnly.isNotEmpty && titleOnly != fullQuery) {
      final fallbackResults = await searchSongs(titleOnly, limit: 5);
      if (fallbackResults.isNotEmpty) return fallbackResults.first;
    }

    return null;
  }

  Future<List<JioSaavnTrack>> _runSearch(String query, int limit) async {
    for (var attempt = 0; attempt <= maxRetries; attempt++) {
      for (final endpoint in endpoints) {
        try {
          final tracks = await _tryEndpoint(endpoint, query, limit);
          if (tracks.isNotEmpty) return tracks;
        } catch (_) {
          // Try next endpoint or retry.
        }
      }
      if (attempt < maxRetries) {
        await Future<void>.delayed(retryDelay * (attempt + 1));
      }
    }
    return const [];
  }

  Future<List<JioSaavnTrack>> _tryEndpoint(
    String endpoint,
    String query,
    int limit,
  ) async {
    final uri = Uri.parse(endpoint).replace(
      queryParameters: <String, String>{
        'query': query,
        'limit': limit.toString(),
      },
    );

    final response = await http.get(uri).timeout(requestTimeout);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _HttpException('HTTP ${response.statusCode}');
    }

    final decoded = jsonDecode(response.body);
    List<dynamic>? rawResults;

    if (decoded is Map<String, dynamic>) {
      final data = decoded['data'];
      if (decoded['success'] == true &&
          data is Map<String, dynamic> &&
          data['results'] is List) {
        rawResults = data['results'] as List<dynamic>;
      } else if (decoded['results'] is List) {
        rawResults = decoded['results'] as List<dynamic>;
      }
    } else if (decoded is List) {
      rawResults = decoded;
    }

    if (rawResults == null) {
      throw const FormatException('Unexpected JioSaavn response format');
    }

    return rawResults
        .whereType<Map<String, dynamic>>()
        .map(JioSaavnTrack.fromJson)
        .toList();
  }
}

class _HttpException implements Exception {
  final String message;
  const _HttpException(this.message);

  @override
  String toString() => '_HttpException: $message';
}
