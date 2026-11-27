import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/song.dart';
import '../services/jiosaavn_service.dart';
import '../state/app_controller.dart';
import '../theme/spotify_theme.dart';

class ArtistAlbumScreen extends StatefulWidget {
  const ArtistAlbumScreen({
    super.key,
    required this.artistName,
    required this.controller,
    required this.localSongs,
    required this.accent,
  });

  final String artistName;
  final AppController controller;
  final List<Song> localSongs;
  final Color accent;

  @override
  State<ArtistAlbumScreen> createState() => _ArtistAlbumScreenState();
}

class _ArtistAlbumScreenState extends State<ArtistAlbumScreen> {
  final List<JioSaavnTrack> _discoveredTracks = [];
  bool _isLoadingMore = true;
  String? _coverImageUrl;

  @override
  void initState() {
    super.initState();
    _coverImageUrl = widget.localSongs
        .map((s) => s.imageUrl)
        .whereType<String>()
        .where((u) => u.trim().isNotEmpty)
        .firstOrNull;
    _loadArtistTracks();
  }

  Future<void> _loadArtistTracks() async {
    try {
      final results = await JioSaavnService.instance.searchSongs(
        widget.artistName,
        limit: 20,
      );
      if (!mounted) return;

      final lowerArtist = widget.artistName.trim().toLowerCase();
      final existingKeys =
          widget.localSongs.map((s) => s.songKey).toSet();

      final matching = <JioSaavnTrack>[];
      final fallback = <JioSaavnTrack>[];
      for (final track in results) {
        final key = Song.computeKey(track.title, track.artist);
        if (existingKeys.contains(key)) continue;
        existingKeys.add(key);

        if (track.artist.toLowerCase().contains(lowerArtist)) {
          matching.add(track);
        } else {
          fallback.add(track);
        }
      }

      final combined = [...matching, ...fallback];
      setState(() {
        _discoveredTracks
          ..clear()
          ..addAll(combined);
        _coverImageUrl ??= combined
            .map((t) => t.imageUrl)
            .whereType<String>()
            .where((u) => u.trim().isNotEmpty)
            .firstOrNull;
        _isLoadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoadingMore = false);
    }
  }

  List<Song> _buildCombinedPlaylist(List<Song> liveLocalSongs) {
    final defaultCat = liveLocalSongs.firstOrNull?.category ?? 'Happy';
    final quality = widget.controller.audioHandler.qualityNotifier.value;
    final discoveredSongs = _discoveredTracks
        .map((t) => t.toSong(defaultCat, quality: quality))
        .toList();
    return [...liveLocalSongs, ...discoveredSongs];
  }

  void _openAddToCategorySheet(JioSaavnTrack track) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: SpotifyColors.elevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheetCtx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  track.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: SpotifyColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  track.artist,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: SpotifyColors.textSecondary,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Save to mood playlist',
                  style: TextStyle(
                    color: SpotifyColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: kCategories.map((cat) {
                    final color = moodColor(cat);
                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: color.withValues(alpha: 0.2),
                            foregroundColor: color,
                          ),
                          onPressed: () async {
                            Navigator.of(sheetCtx).pop();
                            await widget.controller
                                .addSearchTrackToCategory(track, cat);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Saved "${track.title}" to $cat'),
                                ),
                              );
                            }
                          },
                          child: Text(cat),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final lowerArtist = widget.artistName.trim().toLowerCase();

    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final liveLocalSongs = widget.controller.songs
            .where(
              (s) =>
                  !s.isRemoved &&
                  s.artist.toLowerCase().contains(lowerArtist),
            )
            .toList();
        final fullQueue = _buildCombinedPlaylist(liveLocalSongs);
        final coverUrl = liveLocalSongs
                .map((s) => s.imageUrl)
                .whereType<String>()
                .where((u) => u.trim().isNotEmpty)
                .firstOrNull ??
            _coverImageUrl;

        return Scaffold(
          backgroundColor: SpotifyColors.scaffoldBackground,
          body: CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 280,
                pinned: true,
                backgroundColor: SpotifyColors.scaffoldBackground,
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          widget.accent.withValues(alpha: 0.72),
                          SpotifyColors.scaffoldBackground,
                        ],
                      ),
                    ),
                    child: SafeArea(
                      bottom: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 44, 20, 16),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Container(
                              width: 152,
                              height: 152,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.45),
                                    blurRadius: 20,
                                    offset: const Offset(0, 10),
                                  ),
                                ],
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: (coverUrl != null && coverUrl.isNotEmpty)
                                  ? CachedNetworkImage(
                                      imageUrl: coverUrl,
                                      fit: BoxFit.cover,
                                      errorWidget: (_, _, _) =>
                                          _artistFallback(widget.accent),
                                    )
                                  : _artistFallback(widget.accent),
                            ),
                            const SizedBox(height: 14),
                            Text(
                              '${widget.artistName} Mix',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: SpotifyColors.textPrimary,
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Artist Playlist • ${fullQueue.length} tracks',
                              style: TextStyle(
                                color: SpotifyColors.textSecondary,
                                fontSize: 12.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: SpotifyColors.spotifyGreen,
                            foregroundColor: SpotifyColors.onAccent,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          onPressed: fullQueue.isEmpty
                              ? null
                              : () => widget.controller
                                  .playSongsList(fullQueue, shuffle: false),
                          icon: const Icon(Icons.play_arrow_rounded),
                          label: const Text(
                            'Play',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: SpotifyColors.textPrimary,
                            side: BorderSide(color: SpotifyColors.elevated),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          onPressed: fullQueue.isEmpty
                              ? null
                              : () => widget.controller
                                  .playSongsList(fullQueue, shuffle: true),
                          icon: const Icon(Icons.shuffle_rounded),
                          label: const Text(
                            'Shuffle',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (liveLocalSongs.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(16, 8, 16, 6),
                    child: Text(
                      'In Your Library',
                      style: TextStyle(
                        color: SpotifyColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                SliverList.builder(
                  itemCount: liveLocalSongs.length,
                  itemBuilder: (_, index) {
                    final song = liveLocalSongs[index];
                    return _LibraryArtistTile(
                      song: song,
                      accent: widget.accent,
                      onTap: () => widget.controller
                          .playSong(song, queue: fullQueue),
                      onToggleLike: () => widget.controller.toggleLike(song),
                    );
                  },
                ),
              ],
              if (_isLoadingMore)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Center(
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          color: SpotifyColors.spotifyGreen,
                        ),
                      ),
                    ),
                  ),
                )
              else if (_discoveredTracks.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                    child: Text(
                      'More by ${widget.artistName}',
                      style: TextStyle(
                        color: SpotifyColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                SliverList.builder(
                  itemCount: _discoveredTracks.length,
                  itemBuilder: (_, index) {
                    final track = _discoveredTracks[index];
                    final song = track.toSong(
                      liveLocalSongs.firstOrNull?.category ?? 'Happy',
                      quality:
                          widget.controller.audioHandler.qualityNotifier.value,
                    );
                    return ListTile(
                      onTap: () =>
                          widget.controller.playSong(song, queue: fullQueue),
                      leading: ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: SizedBox(
                          width: 48,
                          height: 48,
                          child: (track.imageUrl != null &&
                                  track.imageUrl!.isNotEmpty)
                              ? CachedNetworkImage(
                                  imageUrl: track.imageUrl!,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, _, _) =>
                                      _artistFallback(widget.accent),
                                )
                              : _artistFallback(widget.accent),
                        ),
                      ),
                      title: Text(
                        track.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: SpotifyColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      subtitle: Text(
                        track.artist,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: SpotifyColors.textSecondary,
                          fontSize: 12.5,
                        ),
                      ),
                      trailing: IconButton(
                        icon: Icon(
                          Icons.add_circle_outline_rounded,
                          color: SpotifyColors.textSecondary,
                        ),
                        tooltip: 'Save to Mood',
                        onPressed: () => _openAddToCategorySheet(track),
                      ),
                    );
                  },
                ),
              ],
              const SliverToBoxAdapter(child: SizedBox(height: 110)),
            ],
          ),
        );
      },
    );
  }

  Widget _artistFallback(Color accent) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [accent.withValues(alpha: 0.7), SpotifyColors.elevated],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Icon(
          Icons.album_rounded,
          color: SpotifyColors.textPrimary.withValues(alpha: 0.85),
          size: 38,
        ),
      ),
    );
  }
}

class _LibraryArtistTile extends StatelessWidget {
  const _LibraryArtistTile({
    required this.song,
    required this.accent,
    required this.onTap,
    required this.onToggleLike,
  });

  final Song song;
  final Color accent;
  final VoidCallback onTap;
  final VoidCallback onToggleLike;

  @override
  Widget build(BuildContext context) {
    final url = song.imageUrl?.trim() ?? '';
    return ListTile(
      onTap: onTap,
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: SizedBox(
          width: 48,
          height: 48,
          child: url.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.cover,
                  errorWidget: (_, _, _) => _fallback(),
                )
              : _fallback(),
        ),
      ),
      title: Text(
        song.title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: SpotifyColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(
        '${song.category} • ${song.artist}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: SpotifyColors.textSecondary,
          fontSize: 12.5,
        ),
      ),
      trailing: IconButton(
        onPressed: onToggleLike,
        icon: Icon(
          song.isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
          color: song.isLiked
              ? SpotifyColors.spotifyGreen
              : SpotifyColors.textSecondary,
        ),
      ),
    );
  }

  Widget _fallback() {
    return Container(
      color: accent.withValues(alpha: 0.25),
      child: Icon(Icons.music_note_rounded, color: accent),
    );
  }
}
