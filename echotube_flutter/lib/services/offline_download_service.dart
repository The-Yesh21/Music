import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../data/database_helper.dart';
import '../models/song.dart';
import 'jiosaavn_service.dart';

class OfflineDownloadService {
  static final OfflineDownloadService instance = OfflineDownloadService._();

  OfflineDownloadService._();

  Future<String?> downloadSong(
    Song song,
    DatabaseHelper db, {
    AudioQuality quality = AudioQuality.high,
    void Function(double progress)? onProgress,
  }) async {
    String? streamUrl = song.streamUrl;
    if (streamUrl == null || streamUrl.isEmpty) {
      final track = await JioSaavnService.instance.resolveTrackForSong(song);
      streamUrl = track?.bestUrlForQuality(quality);
      if (streamUrl == null || streamUrl.isEmpty) {
        return null;
      }

      final resolvedImage = (song.imageUrl == null || song.imageUrl!.isEmpty)
          ? track?.imageUrl
          : song.imageUrl;
      await db.upsertSong(
        song.copyWith(
          streamUrl: streamUrl,
          imageUrl: resolvedImage,
        ),
      );
    }

    final docsDir = await getApplicationDocumentsDirectory();
    final audioDir = Directory(p.join(docsDir.path, 'offline_audio'));
    if (!await audioDir.exists()) {
      await audioDir.create(recursive: true);
    }

    final safeFileName = _toSafeFileName(song.songKey);
    final filePath = p.join(audioDir.path, '$safeFileName.m4a');
    final tempFile = File('$filePath.part');
    final targetFile = File(filePath);

    final client = http.Client();
    IOSink? sink;
    try {
      final request = http.Request('GET', Uri.parse(streamUrl));
      final response = await client.send(request);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return null;
      }

      final contentLength = response.contentLength ?? 0;
      var receivedBytes = 0;

      sink = tempFile.openWrite();
      await for (final chunk in response.stream) {
        sink.add(chunk);
        receivedBytes += chunk.length;
        if (contentLength > 0) {
          onProgress?.call((receivedBytes / contentLength).clamp(0.0, 1.0));
        }
      }

      await sink.flush();
      await sink.close();
      sink = null;

      if (await targetFile.exists()) {
        await targetFile.delete();
      }
      await tempFile.rename(filePath);

      onProgress?.call(1.0);
      await db.setLocalAudioPath(song.songKey, filePath);
      return filePath;
    } catch (_) {
      try {
        await sink?.close();
      } catch (_) {}
      if (await tempFile.exists()) {
        try {
          await tempFile.delete();
        } catch (_) {}
      }
      return null;
    } finally {
      client.close();
    }
  }

  Future<void> deleteDownload(Song song, DatabaseHelper db) async {
    final localPath = song.localAudioPath;
    if (localPath != null && localPath.isNotEmpty) {
      final file = File(localPath);
      if (await file.exists()) {
        await file.delete();
      }
    }
    await db.setLocalAudioPath(song.songKey, null);
  }

  String _toSafeFileName(String key) {
    final sanitized = key
        .replaceAll(RegExp(r'[^a-zA-Z0-9_-]+'), '_')
        .replaceAll(RegExp(r'_+'), '_')
        .replaceAll(RegExp(r'^_|_$'), '');
    return sanitized.isEmpty ? 'track' : sanitized;
  }
}
