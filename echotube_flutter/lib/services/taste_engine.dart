import '../models/song.dart';
import 'jiosaavn_service.dart';
import 'youtube_playlist_service.dart';

class TasteProfile {
  const TasteProfile({
    required this.artistScores,
    required this.categoryScores,
    required this.genreScores,
    required this.moodScores,
    required this.topArtists,
    required this.topGenres,
    required this.dominantCategory,
  });

  final Map<String, double> artistScores;
  final Map<String, double> categoryScores;
  final Map<String, double> genreScores;
  final Map<String, double> moodScores;
  final List<String> topArtists;
  final List<String> topGenres;
  final String dominantCategory;
}

class RecommendedSong {
  const RecommendedSong({
    required this.song,
    required this.score,
    required this.reason,
  });

  final Song song;
  final double score;
  final String reason;
}

class DiscoveredRecommendation {
  const DiscoveredRecommendation({
    required this.track,
    required this.suggestedCategory,
    required this.reason,
  });

  final JioSaavnTrack track;
  final String suggestedCategory;
  final String reason;
}

/// On-device recommendation engine that builds a weighted taste profile
/// from the user's library, likes, play history, and currently playing track.
class TasteEngine {
  TasteEngine._();

  static final TasteEngine instance = TasteEngine._();

  TasteProfile buildProfile(
    List<Song> library, {
    Song? currentSong,
  }) {
    final artistScores = <String, double>{};
    final artistDisplay = <String, String>{};
    final categoryScores = <String, double>{};
    final genreScores = <String, double>{};
    final genreDisplay = <String, String>{};
    final moodScores = <String, double>{};

    final nowMs = DateTime.now().millisecondsSinceEpoch;
    const dayMs = 86400000;

    void addWeight(Song song, double weight) {
      final cat = song.category.trim();
      if (cat.isNotEmpty) {
        categoryScores[cat] = (categoryScores[cat] ?? 0) + weight;
      }

      for (final rawArtist in song.artist.split(',')) {
        final trimmed = rawArtist.trim();
        final lower = trimmed.toLowerCase();
        if (lower.isEmpty || lower == 'unknown artist') continue;
        artistDisplay.putIfAbsent(lower, () => trimmed);
        artistScores[lower] = (artistScores[lower] ?? 0) + weight;
      }

      for (final token in _splitTokens(song.genre)) {
        final lower = token.toLowerCase();
        genreDisplay.putIfAbsent(lower, () => token);
        genreScores[lower] = (genreScores[lower] ?? 0) + weight;
      }

      for (final token in _splitTokens(song.mood)) {
        final lower = token.toLowerCase();
        moodScores[lower] = (moodScores[lower] ?? 0) + weight;
      }
    }

    for (final song in library) {
      if (song.isRemoved) continue;
      var w = 1.0;
      if (song.isLiked) w += 4.0;
      if (song.isCustom) w += 2.0;
      if (song.playCount > 0) {
        w += (song.playCount.clamp(1, 10)) * 1.2;
      }
      if (song.lastPlayedAt != null) {
        final age = nowMs - song.lastPlayedAt!;
        if (age <= dayMs) {
          w += 2.0;
        } else if (age <= 7 * dayMs) {
          w += 1.0;
        }
      }
      addWeight(song, w);
    }

    if (currentSong != null) {
      addWeight(currentSong, 5.5);
    }

    final sortedArtists = artistScores.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final sortedGenres = genreScores.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final sortedCategories = categoryScores.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return TasteProfile(
      artistScores: artistScores,
      categoryScores: categoryScores,
      genreScores: genreScores,
      moodScores: moodScores,
      topArtists: sortedArtists
          .take(8)
          .map((e) => artistDisplay[e.key] ?? e.key)
          .toList(),
      topGenres: sortedGenres
          .take(6)
          .map((e) => genreDisplay[e.key] ?? e.key)
          .toList(),
      dominantCategory: sortedCategories.isNotEmpty
          ? sortedCategories.first.key
          : (currentSong?.category ?? 'Happy'),
    );
  }

  /// Ranks songs from the existing library based on [profile] and [currentSong].
  List<RecommendedSong> recommendFromLibrary(
    List<Song> library, {
    Song? currentSong,
    int limit = 15,
  }) {
    final profile = buildProfile(library, currentSong: currentSong);
    final currentArtists = currentSong != null
        ? currentSong.artist
            .split(',')
            .map((a) => a.trim().toLowerCase())
            .where((a) => a.isNotEmpty)
            .toSet()
        : <String>{};
    final currentGenres = currentSong != null
        ? _splitTokens(currentSong.genre).map((g) => g.toLowerCase()).toSet()
        : <String>{};
    final currentMoods = currentSong != null
        ? _splitTokens(currentSong.mood).map((m) => m.toLowerCase()).toSet()
        : <String>{};

    final scored = <RecommendedSong>[];

    for (final song in library) {
      if (song.isRemoved) continue;
      if (currentSong != null && song.songKey == currentSong.songKey) continue;

      var score = 0.0;
      String? reason;

      final songArtists = song.artist
          .split(',')
          .map((a) => a.trim())
          .where((a) => a.isNotEmpty)
          .toList();

      for (final a in songArtists) {
        final lower = a.toLowerCase();
        if (currentArtists.contains(lower)) {
          score += 8.0;
          reason ??= 'More from $a';
        }
        final artistAffinity = profile.artistScores[lower] ?? 0;
        if (artistAffinity > 0) {
          score += artistAffinity * 1.4;
          reason ??= 'Because you listen to $a';
        }
      }

      if (currentSong != null &&
          song.category.toLowerCase() == currentSong.category.toLowerCase()) {
        score += 3.5;
        reason ??= 'Matches ${currentSong.category} vibe';
      }
      score += (profile.categoryScores[song.category] ?? 0) * 0.25;

      for (final g in _splitTokens(song.genre)) {
        final lower = g.toLowerCase();
        if (currentGenres.contains(lower)) {
          score += 3.0;
          reason ??= 'Similar $g sound';
        }
        score += (profile.genreScores[lower] ?? 0) * 0.2;
      }

      for (final m in _splitTokens(song.mood)) {
        final lower = m.toLowerCase();
        if (currentMoods.contains(lower)) {
          score += 2.5;
          reason ??= 'Similar $m mood';
        }
        score += (profile.moodScores[lower] ?? 0) * 0.15;
      }

      // Surface fresh/unplayed gems in the user's taste instead of only overplayed tracks.
      if (song.playCount == 0) {
        score += 2.5;
      } else if (song.isLiked) {
        score += 1.5;
      }

      if (score > 0) {
        scored.add(
          RecommendedSong(
            song: song,
            score: score,
            reason: reason ?? 'Picked for your ${song.category} taste',
          ),
        );
      }
    }

    scored.sort((a, b) => b.score.compareTo(a.score));
    return scored.take(limit).toList();
  }

  /// Queries JioSaavn using the user's taste profile & current track to discover
  /// new songs that are NOT already in [allExistingSongs].
  Future<List<DiscoveredRecommendation>> discoverNewSongs({
    required List<Song> allExistingSongs,
    Song? currentSong,
    JioSaavnService? jiosaavn,
    int limit = 15,
  }) async {
    final service = jiosaavn ?? JioSaavnService.instance;
    final visibleLibrary = allExistingSongs.where((s) => !s.isRemoved).toList();
    final profile = buildProfile(visibleLibrary, currentSong: currentSong);

    final queries = <({String query, String reason, String category})>[];
    if (currentSong != null) {
      final firstArtist = currentSong.artist.split(',').first.trim();
      if (firstArtist.isNotEmpty) {
        queries.add((
          query: firstArtist,
          reason: 'Similar to ${currentSong.title}',
          category: currentSong.category,
        ));
      }
    }
    for (final artist in profile.topArtists.take(3)) {
      if (queries.any((q) => q.query.toLowerCase() == artist.toLowerCase())) {
        continue;
      }
      queries.add((
        query: artist,
        reason: 'Matches your taste in $artist',
        category: profile.dominantCategory,
      ));
    }
    if (profile.topGenres.isNotEmpty) {
      queries.add((
        query: '${profile.topGenres.first} ${profile.dominantCategory}',
        reason: '${profile.topGenres.first} picks for you',
        category: profile.dominantCategory,
      ));
    }

    final discovered = <DiscoveredRecommendation>[];
    final seenKeys = <String>{};

    for (final q in queries.take(4)) {
      if (discovered.length >= limit) break;
      try {
        final results = await service.searchSongs(q.query, limit: 10);
        for (final track in results) {
          if (discovered.length >= limit) break;
          final key = Song.computeKey(track.title, track.artist);
          if (!seenKeys.add(key)) continue;

          final ytLike = YouTubePlaylistTrack(
            videoId: track.id,
            title: track.title,
            artist: track.artist,
          );
          if (YouTubePlaylistService.isDuplicateTrack(ytLike, allExistingSongs)) {
            continue;
          }

          discovered.add(
            DiscoveredRecommendation(
              track: track,
              suggestedCategory: q.category,
              reason: q.reason,
            ),
          );
        }
      } catch (_) {
        // Continue with remaining taste queries if one fails.
      }
    }

    return discovered;
  }

  static Iterable<String> _splitTokens(String raw) {
    return raw
        .split(RegExp(r'[/,&]+'))
        .map((t) => t.trim())
        .where((t) =>
            t.isNotEmpty &&
            t.toLowerCase() != 'custom' &&
            t.toLowerCase() != 'discovered' &&
            t.toLowerCase() != 'imported');
  }
}
