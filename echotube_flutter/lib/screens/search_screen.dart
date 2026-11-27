import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/song.dart';
import '../services/jiosaavn_service.dart';
import '../state/app_controller.dart';
import '../theme/spotify_theme.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({
    super.key,
    required this.controller,
  });

  final AppController controller;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _textController = TextEditingController();
  Timer? _debounce;
  List<JioSaavnTrack> _results = const [];
  bool _isSearching = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    _textController.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _results = const [];
        _isSearching = false;
        _error = null;
      });
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 400), () {
      _performSearch(trimmed);
    });
  }

  Future<void> _performSearch(String query) async {
    setState(() {
      _isSearching = true;
      _error = null;
    });

    try {
      final tracks = await JioSaavnService.instance.searchSongs(query);
      if (!mounted) return;
      setState(() {
        _results = tracks;
        _isSearching = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not fetch search results. Check your connection.';
        _isSearching = false;
      });
    }
  }

  Future<void> _handleTrackTap(JioSaavnTrack track) async {
    await widget.controller.audioHandler.playSong(track.toSong('Happy'));
    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Save "${track.title}" to Mood',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
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
                ...kCategories.map(
                  (category) => Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      tileColor: SpotifyColors.elevated,
                      leading: CircleAvatar(
                        backgroundColor:
                            moodColor(category).withValues(alpha: 0.2),
                        child: Icon(
                          Icons.library_music_rounded,
                          color: moodColor(category),
                          size: 20,
                        ),
                      ),
                      title: Text(
                        category,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      trailing: const Icon(Icons.add_circle_outline_rounded),
                      onTap: () async {
                        Navigator.of(ctx).pop();
                        await widget.controller
                            .addSearchTrackToCategory(track, category);
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              'Saved "${track.title}" to $category',
                            ),
                          ),
                        );
                      },
                    ),
                  ),
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
    final hasQuery = _textController.text.trim().isNotEmpty;

    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Text(
              'Search',
              style: TextStyle(
                color: SpotifyColors.textPrimary,
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _textController,
              onChanged: _onQueryChanged,
              style: const TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w500,
              ),
              decoration: InputDecoration(
                hintText: 'What do you want to listen to?',
                hintStyle: TextStyle(
                  color: Colors.black.withValues(alpha: 0.65),
                  fontWeight: FontWeight.w500,
                ),
                prefixIcon: const Icon(Icons.search_rounded, color: Colors.black),
                suffixIcon: hasQuery
                    ? IconButton(
                        onPressed: () {
                          _textController.clear();
                          _onQueryChanged('');
                        },
                        icon: const Icon(Icons.close_rounded, color: Colors.black),
                      )
                    : null,
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: !hasQuery
                ? _BrowseMoodsGrid(
                    controller: widget.controller,
                    onSearchGenre: (genre) {
                      _textController.text = genre;
                      _performSearch(genre);
                    },
                  )
                : _isSearching
                    ? Center(
                        child: CircularProgressIndicator(
                          color: SpotifyColors.spotifyGreen,
                        ),
                      )
                    : _error != null
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Text(
                                _error!,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: SpotifyColors.textSecondary,
                                ),
                              ),
                            ),
                          )
                        : _results.isEmpty
                            ? Center(
                                child: Text(
                                  'No matching tracks found',
                                  style: TextStyle(
                                    color: SpotifyColors.textSecondary,
                                  ),
                                ),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.only(bottom: 130),
                                itemCount: _results.length,
                                itemBuilder: (_, index) {
                                  final track = _results[index];
                                  return _SearchTrackTile(
                                    track: track,
                                    onTap: () => _handleTrackTap(track),
                                  );
                                },
                              ),
          ),
        ],
      ),
    );
  }
}

class _BrowseMoodsGrid extends StatelessWidget {
  const _BrowseMoodsGrid({
    required this.controller,
    required this.onSearchGenre,
  });

  final AppController controller;
  final ValueChanged<String> onSearchGenre;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final cards = <_BrowseCardData>[
          _BrowseCardData(
            title: 'Happy',
            subtitle: 'Play mood mix',
            color: SpotifyColors.happy,
            isMood: true,
          ),
          _BrowseCardData(
            title: 'Lonely',
            subtitle: 'Play mood mix',
            color: SpotifyColors.lonely,
            isMood: true,
          ),
          _BrowseCardData(
            title: 'Enjoyment',
            subtitle: 'Play mood mix',
            color: SpotifyColors.enjoyment,
            isMood: true,
          ),
          ...controller.topGenres.take(5).toList().asMap().entries.map(
                (entry) => _BrowseCardData(
                  title: entry.value,
                  subtitle: 'Your top genre',
                  color: _genreColors[entry.key % _genreColors.length],
                  isMood: false,
                ),
              ),
        ];

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 130),
          children: [
            Text(
              'Browse Moods & Genres',
              style: TextStyle(
                color: SpotifyColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: cards.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.75,
              ),
              itemBuilder: (_, index) {
                final card = cards[index];
                return Material(
                  color: card.color,
                  borderRadius: BorderRadius.circular(8),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () {
                      if (card.isMood) {
                        controller.playCategory(card.title, shuffle: true);
                      } else {
                        onSearchGenre(card.title);
                      }
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            card.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            card.subtitle,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.85),
                              fontSize: 11.5,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }

  static const List<Color> _genreColors = [
    Color(0xFF0D9488),
    Color(0xFFE11D48),
    Color(0xFF7C3AED),
    Color(0xFF2563EB),
    Color(0xFFD97706),
  ];
}

class _BrowseCardData {
  const _BrowseCardData({
    required this.title,
    required this.subtitle,
    required this.color,
    required this.isMood,
  });

  final String title;
  final String subtitle;
  final Color color;
  final bool isMood;
}

class _SearchTrackTile extends StatelessWidget {
  const _SearchTrackTile({
    required this.track,
    required this.onTap,
  });

  final JioSaavnTrack track;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final url = (track.imageUrl ?? '').trim();
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
                  placeholder: (_, _) => _fallback(),
                  errorWidget: (_, _, _) => _fallback(),
                )
              : _fallback(),
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
        style: TextStyle(color: SpotifyColors.textSecondary),
      ),
      trailing: Icon(
        Icons.add_circle_outline_rounded,
        color: SpotifyColors.textSecondary,
      ),
    );
  }

  Widget _fallback() {
    return Container(
      color: SpotifyColors.elevated,
      child: Icon(
        Icons.music_note_rounded,
        color: SpotifyColors.textSecondary,
      ),
    );
  }
}
