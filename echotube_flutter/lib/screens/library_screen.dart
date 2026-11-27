import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/song.dart';
import '../state/app_controller.dart';
import '../theme/spotify_theme.dart';

enum _LibraryFilter { all, happy, lonely, enjoyment, liked, downloaded }

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({
    super.key,
    required this.controller,
  });

  final AppController controller;

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  _LibraryFilter _selectedFilter = _LibraryFilter.all;
  bool _isBatchDownloading = false;

  List<Song> _filteredSongs() {
    switch (_selectedFilter) {
      case _LibraryFilter.all:
        return widget.controller.songs;
      case _LibraryFilter.happy:
        return widget.controller.songsForCategory('Happy');
      case _LibraryFilter.lonely:
        return widget.controller.songsForCategory('Lonely');
      case _LibraryFilter.enjoyment:
        return widget.controller.songsForCategory('Enjoyment');
      case _LibraryFilter.liked:
        return widget.controller.likedSongs;
      case _LibraryFilter.downloaded:
        return widget.controller.downloadedSongs;
    }
  }

  String _filterLabel(_LibraryFilter filter) {
    switch (filter) {
      case _LibraryFilter.all:
        return 'All';
      case _LibraryFilter.happy:
        return 'Happy';
      case _LibraryFilter.lonely:
        return 'Lonely';
      case _LibraryFilter.enjoyment:
        return 'Enjoyment';
      case _LibraryFilter.liked:
        return 'Liked';
      case _LibraryFilter.downloaded:
        return 'Downloaded';
    }
  }

  Future<void> _downloadAll(List<Song> songs) async {
    final pending = songs.where((s) => !s.isDownloaded).toList();
    if (pending.isEmpty || _isBatchDownloading) return;

    setState(() => _isBatchDownloading = true);
    try {
      for (final song in pending) {
        if (!mounted) break;
        await widget.controller.downloadSong(song);
      }
    } finally {
      if (mounted) {
        setState(() => _isBatchDownloading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final filtered = _filteredSongs();

        return SafeArea(
          bottom: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Your Library',
                        style: TextStyle(
                          color: SpotifyColors.textPrimary,
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      '${filtered.length} songs',
                      style: TextStyle(
                        color: SpotifyColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(
                height: 42,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  scrollDirection: Axis.horizontal,
                  itemCount: _LibraryFilter.values.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, index) {
                    final filter = _LibraryFilter.values[index];
                    final selected = _selectedFilter == filter;
                    return ChoiceChip(
                      label: Text(_filterLabel(filter)),
                      selected: selected,
                      showCheckmark: false,
                      onSelected: (_) {
                        setState(() => _selectedFilter = filter);
                      },
                    );
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Row(
                  children: [
                    ElevatedButton.icon(
                      onPressed: filtered.isEmpty
                          ? null
                          : () => widget.controller.playSongsList(
                                filtered,
                                shuffle: true,
                              ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: SpotifyColors.spotifyGreen,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 11,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                      icon: const Icon(Icons.shuffle_rounded, size: 20),
                      label: const Text(
                        'Shuffle Play',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    Spacer(),
                    OutlinedButton.icon(
                      onPressed: filtered.isEmpty || _isBatchDownloading
                          ? null
                          : () => _downloadAll(filtered),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: SpotifyColors.textPrimary,
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.25),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                      icon: _isBatchDownloading
                          ? SizedBox(
                              width: 15,
                              height: 15,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: SpotifyColors.spotifyGreen,
                              ),
                            )
                          : const Icon(
                              Icons.download_for_offline_outlined,
                              size: 18,
                            ),
                      label: Text(
                        _isBatchDownloading ? 'Downloading' : 'Download All',
                        style: const TextStyle(fontSize: 12.5),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Text(
                          'No songs in this view yet',
                          style: TextStyle(color: SpotifyColors.textSecondary),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.only(bottom: 130),
                        itemCount: filtered.length,
                        itemBuilder: (_, index) {
                          final song = filtered[index];
                          return _LibrarySongTile(
                            song: song,
                            queue: filtered,
                            controller: widget.controller,
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _LibrarySongTile extends StatelessWidget {
  const _LibrarySongTile({
    required this.song,
    required this.queue,
    required this.controller,
  });

  final Song song;
  final List<Song> queue;
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final accent = moodColor(song.category);
    final url = song.imageUrl?.trim() ?? '';
    final progress = controller.downloadProgress[song.songKey];
    final currentKey = controller.audioHandler.currentSongNotifier.value?.songKey;
    final isCurrent = currentKey == song.songKey;

    return ListTile(
      onTap: () => controller.playSong(song, queue: queue),
      contentPadding: const EdgeInsets.fromLTRB(16, 4, 8, 4),
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: SizedBox(
          width: 50,
          height: 50,
          child: url.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.cover,
                  placeholder: (_, _) => _fallback(accent),
                  errorWidget: (_, _, _) => _fallback(accent),
                )
              : _fallback(accent),
        ),
      ),
      title: Text(
        song.title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: isCurrent
              ? SpotifyColors.spotifyGreen
              : SpotifyColors.textPrimary,
          fontWeight: FontWeight.w600,
          fontSize: 14.5,
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Row(
          children: [
            if (song.isDownloaded) ...[
              Icon(
                Icons.arrow_circle_down_rounded,
                size: 14,
                color: SpotifyColors.spotifyGreen,
              ),
              const SizedBox(width: 4),
            ],
            Flexible(
              child: Text(
                song.artist,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: SpotifyColors.textSecondary,
                  fontSize: 12.5,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                song.category,
                style: TextStyle(
                  color: accent,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (progress != null)
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 10),
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  value: progress > 0 ? progress : null,
                  strokeWidth: 2,
                  color: SpotifyColors.spotifyGreen,
                ),
              ),
            )
          else
            IconButton(
              onPressed: () {
                if (song.isDownloaded) {
                  controller.deleteDownload(song);
                } else {
                  controller.downloadSong(song);
                }
              },
              icon: Icon(
                song.isDownloaded
                    ? Icons.download_done_rounded
                    : Icons.download_for_offline_outlined,
                size: 20,
                color: song.isDownloaded
                    ? SpotifyColors.spotifyGreen
                    : SpotifyColors.textSecondary,
              ),
              tooltip: song.isDownloaded ? 'Downloaded' : 'Download',
            ),
          IconButton(
            onPressed: () => controller.toggleLike(song),
            icon: Icon(
              song.isLiked ? Icons.favorite : Icons.favorite_border,
              size: 20,
              color: song.isLiked
                  ? SpotifyColors.spotifyGreen
                  : SpotifyColors.textSecondary,
            ),
            tooltip: song.isLiked ? 'Unlike' : 'Like',
          ),
          PopupMenuButton<String>(
            color: SpotifyColors.elevated,
            icon: Icon(
              Icons.more_vert_rounded,
              color: SpotifyColors.textSecondary,
              size: 20,
            ),
            onSelected: (action) {
              switch (action) {
                case 'play_next':
                  final currentQueue =
                      List<Song>.from(controller.audioHandler.queueNotifier.value);
                  final current =
                      controller.audioHandler.currentSongNotifier.value;
                  if (current == null) {
                    controller.playSong(song);
                  } else {
                    final idx = currentQueue
                        .indexWhere((s) => s.songKey == current.songKey);
                    final insertAt = idx >= 0 ? idx + 1 : currentQueue.length;
                    currentQueue.removeWhere((s) => s.songKey == song.songKey);
                    currentQueue.insert(
                      insertAt.clamp(0, currentQueue.length),
                      song,
                    );
                    controller.audioHandler.queueNotifier.value = currentQueue;
                  }
                case 'download':
                  if (song.isDownloaded) {
                    controller.deleteDownload(song);
                  } else {
                    controller.downloadSong(song);
                  }
                case 'remove':
                  controller.removeSong(song);
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem<String>(
                value: 'play_next',
                child: Text('Play Next'),
              ),
              PopupMenuItem<String>(
                value: 'download',
                child: Text(
                  song.isDownloaded ? 'Remove Download' : 'Download Offline',
                ),
              ),
              const PopupMenuItem<String>(
                value: 'remove',
                child: Text('Remove from Library'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _fallback(Color accent) {
    return Container(
      color: SpotifyColors.elevated,
      child: Icon(Icons.music_note_rounded, color: accent),
    );
  }
}
