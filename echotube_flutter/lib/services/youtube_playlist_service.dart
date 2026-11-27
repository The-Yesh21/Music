import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/song.dart';

class YouTubePlaylistTrack {
  const YouTubePlaylistTrack({
    required this.videoId,
    required this.title,
    required this.artist,
    this.thumbnailUrl,
  });

  final String videoId;
  final String title;
  final String artist;
  final String? thumbnailUrl;

  String get songKey => Song.computeKey(title, artist);
}

class YouTubePlaylistService {
  YouTubePlaylistService._();

  static final YouTubePlaylistService instance = YouTubePlaylistService._();

  static const int maxMixTracks = 50;

  static const Map<String, String> _headers = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  /// Returns true if [playlistId] is a dynamic YouTube Mix / Radio (`RD...`).
  static bool isMixPlaylistId(String playlistId) =>
      playlistId.trim().toUpperCase().startsWith('RD');

  /// Extracts a YouTube playlist ID from a full URL or raw playlist ID.
  static String? extractPlaylistId(String input) =>
      parsePlaylistInput(input)?.playlistId;

  /// Parses playlist ID, optional seed video ID, and original watch URL.
  static ({String playlistId, String? videoId, Uri? originalUri})?
      parsePlaylistInput(String input) {
    final trimmed = input.trim();
    if (trimmed.isEmpty) return null;

    final uri = Uri.tryParse(trimmed);
    String? playlistId;
    String? videoId;

    if (uri != null && uri.hasScheme) {
      playlistId = uri.queryParameters['list']?.trim();
      videoId = uri.queryParameters['v']?.trim();
      if ((videoId == null || videoId.isEmpty) &&
          uri.host.contains('youtu.be') &&
          uri.pathSegments.isNotEmpty) {
        videoId = uri.pathSegments.first.trim();
      }
    }

    if (playlistId == null || playlistId.isEmpty) {
      final match = RegExp(r'[?&]list=([a-zA-Z0-9_-]+)').firstMatch(trimmed);
      if (match != null) {
        playlistId = match.group(1);
      } else if (RegExp(r'^[a-zA-Z0-9_-]{10,}$').hasMatch(trimmed)) {
        playlistId = trimmed;
      }
    }

    if (playlistId == null || playlistId.isEmpty) return null;

    if ((videoId == null || videoId.isEmpty)) {
      final vMatch = RegExp(r'[?&]v=([a-zA-Z0-9_-]{6,})').firstMatch(trimmed);
      if (vMatch != null) {
        videoId = vMatch.group(1);
      } else if (isMixPlaylistId(playlistId) && playlistId.length >= 13) {
        // RD<11-char videoId> mixes encode the seed video ID right after "RD".
        videoId = playlistId.substring(2, 13);
      }
    }

    return (
      playlistId: playlistId,
      videoId: (videoId != null && videoId.isNotEmpty) ? videoId : null,
      originalUri: (uri != null && uri.hasScheme) ? uri : null,
    );
  }

  /// Fetches and parses tracks from a standard YouTube playlist or an `RD...` Mix.
  Future<List<YouTubePlaylistTrack>> fetchPlaylistTracks(String urlOrId) async {
    final parsed = parsePlaylistInput(urlOrId);
    if (parsed == null) {
      throw ArgumentError('Invalid YouTube playlist or Mix link.');
    }

    if (isMixPlaylistId(parsed.playlistId)) {
      return _fetchMixTracks(
        playlistId: parsed.playlistId,
        seedVideoId: parsed.videoId,
        originalUri: parsed.originalUri,
      );
    }

    final url = Uri.parse(
      'https://www.youtube.com/playlist?list=${Uri.encodeQueryComponent(parsed.playlistId)}&hl=en',
    );
    final response = await http
        .get(url, headers: _headers)
        .timeout(const Duration(seconds: 15));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(
        'Failed to load YouTube playlist (HTTP ${response.statusCode}).',
      );
    }

    final tracks = parsePlaylistTracksFromHtml(response.body);
    if (tracks.isEmpty) {
      throw StateError(
        'No playable tracks found. Make sure the playlist is Public or Unlisted.',
      );
    }
    return tracks;
  }

  Future<List<YouTubePlaylistTrack>> _fetchMixTracks({
    required String playlistId,
    required String? seedVideoId,
    required Uri? originalUri,
  }) async {
    final firstUri = _buildMixWatchUri(
      playlistId: playlistId,
      videoId: seedVideoId,
      originalUri: originalUri,
    );

    final collected = <YouTubePlaylistTrack>[];
    final seenVideoIds = <String>{};
    final seenKeys = <String>{};

    Uri? nextUri = firstUri;
    for (var hop = 0; hop < 3 && collected.length < maxMixTracks && nextUri != null; hop++) {
      final response = await http
          .get(nextUri, headers: _headers)
          .timeout(const Duration(seconds: 15));

      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (collected.isNotEmpty) break;
        throw StateError(
          'Failed to load YouTube Mix (HTTP ${response.statusCode}).',
        );
      }

      final batch = parsePlaylistTracksFromHtml(response.body);
      if (batch.isEmpty) break;

      var addedInHop = 0;
      for (final track in batch) {
        if (collected.length >= maxMixTracks) break;
        if (track.videoId.isNotEmpty && !seenVideoIds.add(track.videoId)) {
          continue;
        }
        if (!seenKeys.add(track.songKey)) continue;
        collected.add(track);
        addedInHop += 1;
      }

      if (collected.length >= maxMixTracks || addedInHop == 0) break;

      final lastVideoId = batch.last.videoId;
      if (lastVideoId.isEmpty) break;
      nextUri = Uri.parse(
        'https://www.youtube.com/watch?v=${Uri.encodeQueryComponent(lastVideoId)}'
        '&list=${Uri.encodeQueryComponent(playlistId)}'
        '&index=${collected.length}&hl=en',
      );
    }

    if (collected.isEmpty) {
      throw StateError(
        'Could not extract tracks from this YouTube Mix. Try opening the song in YouTube and copying its Mix link.',
      );
    }
    return collected;
  }

  Uri _buildMixWatchUri({
    required String playlistId,
    required String? videoId,
    required Uri? originalUri,
  }) {
    if (originalUri != null && originalUri.path.contains('/watch')) {
      final params = Map<String, String>.from(originalUri.queryParameters);
      params['list'] = playlistId;
      if (videoId != null && videoId.isNotEmpty) {
        params['v'] = videoId;
      }
      params.putIfAbsent('start_radio', () => '1');
      params['hl'] = 'en';
      return Uri.https('www.youtube.com', '/watch', params);
    }

    final params = <String, String>{
      if (videoId != null && videoId.isNotEmpty) 'v': videoId,
      'list': playlistId,
      'start_radio': '1',
      'hl': 'en',
    };
    return Uri.https('www.youtube.com', '/watch', params);
  }

  /// Parses `ytInitialData` from either a `/playlist` page or a `/watch` Mix page.
  static List<YouTubePlaylistTrack> parsePlaylistTracksFromHtml(String html) {
    final jsonText = _extractYtInitialDataJson(html);
    if (jsonText == null) return const [];

    final decoded = jsonDecode(jsonText);
    final renderers = <Map<String, dynamic>>[];
    _collectPlaylistRenderers(decoded, renderers);

    final seen = <String>{};
    final tracks = <YouTubePlaylistTrack>[];

    for (final renderer in renderers) {
      final videoId = renderer['videoId']?.toString() ?? '';
      final rawTitle = _readText(renderer['title']);
      if (rawTitle.isEmpty ||
          rawTitle == '[Deleted video]' ||
          rawTitle == '[Private video]') {
        continue;
      }

      final rawChannel = _readText(renderer['shortBylineText']);
      final parsed = cleanTitleAndArtist(rawTitle, rawChannel);
      final key = Song.computeKey(parsed.title, parsed.artist);
      if (!seen.add(key)) continue;

      final thumbs = renderer['thumbnail']?['thumbnails'];
      String? thumbUrl;
      if (thumbs is List && thumbs.isNotEmpty) {
        final last = thumbs.last;
        if (last is Map && last['url'] != null) {
          thumbUrl = last['url'].toString();
        }
      }

      tracks.add(
        YouTubePlaylistTrack(
          videoId: videoId,
          title: parsed.title,
          artist: parsed.artist,
          thumbnailUrl: thumbUrl,
        ),
      );
    }

    return tracks;
  }

  /// Checks whether [track] already exists in [existingSongs] by exact key or normalized title.
  static bool isDuplicateTrack(
    YouTubePlaylistTrack track,
    Iterable<Song> existingSongs,
  ) {
    final normTitle = normalizeForMatch(track.title);
    final normArtist = normalizeForMatch(track.artist);
    final targetKey = Song.computeKey(track.title, track.artist);

    for (final song in existingSongs) {
      if (song.songKey == targetKey) return true;
      final existingTitle = normalizeForMatch(song.title);
      if (existingTitle.isEmpty || existingTitle != normTitle) continue;

      final existingArtist = normalizeForMatch(song.artist);
      if (normArtist.isEmpty ||
          existingArtist.isEmpty ||
          existingArtist.contains(normArtist) ||
          normArtist.contains(existingArtist)) {
        return true;
      }
    }
    return false;
  }

  static String normalizeForMatch(String text) {
    return text
        .toLowerCase()
        .replaceAll(RegExp(r'\([^)]*\)|\[[^\]]*\]'), ' ')
        .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  static ({String title, String artist}) cleanTitleAndArtist(
    String rawTitle,
    String rawChannel,
  ) {
    var title = rawTitle
        .replaceAll(
          RegExp(
            r'\s*[\(\[](?:official\s*(?:music\s*|lyric\s*)?(?:video|audio|lyrics?|visualizer|mv)|lyrics?|hd|4k|full\s*song|audio)[\)\]]',
            caseSensitive: false,
          ),
          '',
        )
        .replaceAll(RegExp(r'\s*\|\s*.*$'), '')
        .trim();

    var artist = rawChannel
        .replaceAll(RegExp(r'\s*-\s*Topic$', caseSensitive: false), '')
        .replaceAll(RegExp(r'\s*VEVO$', caseSensitive: false), '')
        .replaceAll(RegExp(r'\s*Official$', caseSensitive: false), '')
        .trim();

    if (title.contains(' - ')) {
      final parts = title.split(' - ');
      if (parts.length >= 2 && parts[0].trim().isNotEmpty) {
        final left = parts[0].trim();
        final right = parts.sublist(1).join(' - ').trim();
        if (right.isNotEmpty) {
          artist = left;
          title = right;
        }
      }
    }

    if (title.isEmpty) title = rawTitle.trim();
    if (artist.isEmpty) artist = 'Unknown Artist';
    return (title: title, artist: artist);
  }

  static String? _extractYtInitialDataJson(String html) {
    const markers = ['var ytInitialData = ', 'window["ytInitialData"] = '];
    for (final marker in markers) {
      final startIdx = html.indexOf(marker);
      if (startIdx < 0) continue;
      final jsonStart = html.indexOf('{', startIdx + marker.length);
      if (jsonStart < 0) continue;

      var depth = 0;
      var inString = false;
      var escaped = false;
      for (var i = jsonStart; i < html.length; i++) {
        final ch = html.codeUnitAt(i);
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch == 92) {
            escaped = true;
          } else if (ch == 34) {
            inString = false;
          }
          continue;
        }
        if (ch == 34) {
          inString = true;
        } else if (ch == 123) {
          depth += 1;
        } else if (ch == 125) {
          depth -= 1;
          if (depth == 0) {
            return html.substring(jsonStart, i + 1);
          }
        }
      }
    }
    return null;
  }

  static void _collectPlaylistRenderers(
    dynamic node,
    List<Map<String, dynamic>> out,
  ) {
    if (node is Map) {
      for (final key in const [
        'playlistVideoRenderer',
        'playlistPanelVideoRenderer',
      ]) {
        if (node.containsKey(key) && node[key] is Map) {
          out.add(Map<String, dynamic>.from(node[key] as Map));
          return;
        }
      }
      for (final value in node.values) {
        _collectPlaylistRenderers(value, out);
      }
    } else if (node is List) {
      for (final item in node) {
        _collectPlaylistRenderers(item, out);
      }
    }
  }

  static String _readText(dynamic textObj) {
    if (textObj is Map) {
      if (textObj['simpleText'] != null) {
        return textObj['simpleText'].toString().trim();
      }
      final runs = textObj['runs'];
      if (runs is List && runs.isNotEmpty) {
        return runs
            .whereType<Map>()
            .map((r) => r['text']?.toString() ?? '')
            .join()
            .trim();
      }
    }
    return '';
  }
}
