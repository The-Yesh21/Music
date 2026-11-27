import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/song.dart';
import '../state/app_controller.dart';
import '../theme/spotify_theme.dart';
import 'artist_album_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.controller,
  });

  final AppController controller;

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        if (controller.isLoading) {
          return Center(
            child: CircularProgressIndicator(color: SpotifyColors.spotifyGreen),
          );
        }

        final recentlyPlayed = controller.recentlyPlayed;
        final newlyAdded = controller.newlyAddedSongs;
        final topRotation = controller.mostPlayed.isNotEmpty
            ? controller.mostPlayed
            : controller.songs.take(12).toList();
        final tasteMixes = _buildTasteMixes();
        final artistAlbums = _buildArtistAlbums();

        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _greeting(),
                          style: TextStyle(
                            color: SpotifyColors.textPrimary,
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ),
                      ValueListenableBuilder<AudioQuality>(
                        valueListenable: controller.audioHandler.qualityNotifier,
                        builder: (context, quality, _) {
                          return PopupMenuButton<AudioQuality>(
                            tooltip: 'Audio Quality',
                            color: SpotifyColors.elevated,
                            onSelected: controller.setAudioQuality,
                            itemBuilder: (_) => AudioQuality.values
                                .map(
                                  (q) => PopupMenuItem<AudioQuality>(
                                    value: q,
                                    child: Row(
                                      children: [
                                        Icon(
                                          q == quality
                                              ? Icons.radio_button_checked
                                              : Icons.radio_button_off,
                                          size: 18,
                                          color: q == quality
                                              ? SpotifyColors.spotifyGreen
                                              : SpotifyColors.textSecondary,
                                        ),
                                        const SizedBox(width: 10),
                                        Text(audioQualityLabel(q)),
                                      ],
                                    ),
                                  ),
                                )
                                .toList(),
                            child: Container(
                              padding: EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: SpotifyColors.elevated,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.graphic_eq_rounded,
                                    size: 14,
                                    color: SpotifyColors.spotifyGreen,
                                  ),
                                  const SizedBox(width: 5),
                                  Text(
                                    audioQualityLabel(quality),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(width: 4),
                      IconButton(
                        onPressed: controller.isSyncing
                            ? null
                            : controller.syncNow,
                        icon: controller.isSyncing
                            ? SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: SpotifyColors.spotifyGreen,
                                ),
                              )
                            : const Icon(Icons.sync_rounded),
                        tooltip: 'Sync Cloud',
                      ),
                      IconButton(
                        onPressed: controller.toggleTheme,
                        icon: Icon(
                          controller.isDarkMode
                              ? Icons.wb_sunny_outlined
                              : Icons.nightlight_round,
                          color: SpotifyColors.orangeAccent,
                        ),
                        tooltip: controller.isDarkMode
                            ? 'Switch to Cream Light Theme'
                            : 'Switch to Ink Dark Theme',
                      ),
                      IconButton(
                        onPressed: controller.toggleBatterySaver,
                        icon: Icon(
                          controller.isBatterySaver
                              ? Icons.battery_saver
                              : Icons.battery_std_rounded,
                          color: controller.isBatterySaver
                              ? SpotifyColors.spotifyGreen
                              : SpotifyColors.textPrimary,
                        ),
                        tooltip: 'Battery Saver',
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 3.1,
                ),
                delegate: SliverChildListDelegate([
                  _QuickPickTile(
                    title: 'Liked Songs',
                    accent: SpotifyColors.spotifyGreen,
                    icon: Icons.favorite_rounded,
                    imageUrl: controller.likedSongs.firstOrNull?.imageUrl,
                    onTap: () => controller.playLiked(shuffle: true),
                  ),
                  _QuickPickTile(
                    title: 'Offline Downloads',
                    accent: Color(0xFF10B981),
                    icon: Icons.download_done_rounded,
                    imageUrl: controller.downloadedSongs.firstOrNull?.imageUrl,
                    onTap: () => controller.playDownloaded(shuffle: true),
                  ),
                  _QuickPickTile(
                    title: 'Happy Mix',
                    accent: SpotifyColors.happy,
                    icon: Icons.wb_sunny_rounded,
                    imageUrl:
                        controller.songsForCategory('Happy').firstOrNull?.imageUrl,
                    onTap: () => controller.playCategory('Happy', shuffle: true),
                  ),
                  _QuickPickTile(
                    title: 'Lonely Mix',
                    accent: SpotifyColors.lonely,
                    icon: Icons.nights_stay_rounded,
                    imageUrl:
                        controller.songsForCategory('Lonely').firstOrNull?.imageUrl,
                    onTap: () =>
                        controller.playCategory('Lonely', shuffle: true),
                  ),
                  _QuickPickTile(
                    title: 'Enjoyment Mix',
                    accent: SpotifyColors.enjoyment,
                    icon: Icons.celebration_rounded,
                    imageUrl: controller
                        .songsForCategory('Enjoyment')
                        .firstOrNull
                        ?.imageUrl,
                    onTap: () =>
                        controller.playCategory('Enjoyment', shuffle: true),
                  ),
                  _QuickPickTile(
                    title: 'Most Played',
                    accent: const Color(0xFF38BDF8),
                    icon: Icons.local_fire_department_rounded,
                    imageUrl: topRotation.firstOrNull?.imageUrl,
                    onTap: () =>
                        controller.playSongsList(topRotation, shuffle: false),
                  ),
                ]),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
            const SliverToBoxAdapter(
              child: _SectionHeader(title: 'Made For Your Taste'),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 204,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  scrollDirection: Axis.horizontal,
                  itemCount: tasteMixes.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 14),
                  itemBuilder: (_, index) {
                    final mix = tasteMixes[index];
                    return _TasteMixCard(
                      mix: mix,
                      onTap: () =>
                          controller.playSongsList(mix.songs, shuffle: true),
                    );
                  },
                ),
              ),
            ),
            if (newlyAdded.isNotEmpty) ...[
              const SliverToBoxAdapter(child: SizedBox(height: 22)),
              const SliverToBoxAdapter(
                child: _SectionHeader(title: 'Newly Added'),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 192,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: newlyAdded.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 14),
                    itemBuilder: (_, index) {
                      final song = newlyAdded[index];
                      return _SongShelfCard(
                        song: song,
                        onTap: () =>
                            controller.playSong(song, queue: newlyAdded),
                      );
                    },
                  ),
                ),
              ),
            ],
            if (artistAlbums.isNotEmpty) ...[
              const SliverToBoxAdapter(child: SizedBox(height: 22)),
              const SliverToBoxAdapter(
                child: _SectionHeader(title: 'Artist Albums For Your Taste'),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 204,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: artistAlbums.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 14),
                    itemBuilder: (_, index) {
                      final album = artistAlbums[index];
                      return _ArtistAlbumCard(
                        album: album,
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => ArtistAlbumScreen(
                                artistName: album.artistName,
                                controller: controller,
                                localSongs: album.songs,
                                accent: album.accent,
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ),
            ],
            if (recentlyPlayed.isNotEmpty) ...[
              const SliverToBoxAdapter(child: SizedBox(height: 22)),
              const SliverToBoxAdapter(
                child: _SectionHeader(title: 'Recently Played'),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 192,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: recentlyPlayed.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 14),
                    itemBuilder: (_, index) {
                      final song = recentlyPlayed[index];
                      return _SongShelfCard(
                        song: song,
                        onTap: () =>
                            controller.playSong(song, queue: recentlyPlayed),
                      );
                    },
                  ),
                ),
              ),
            ],
            if (topRotation.isNotEmpty) ...[
              const SliverToBoxAdapter(child: SizedBox(height: 22)),
              const SliverToBoxAdapter(
                child: _SectionHeader(title: 'Top Rotation'),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 192,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: topRotation.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 14),
                    itemBuilder: (_, index) {
                      final song = topRotation[index];
                      return _SongShelfCard(
                        song: song,
                        onTap: () =>
                            controller.playSong(song, queue: topRotation),
                      );
                    },
                  ),
                ),
              ),
            ],
            const SliverToBoxAdapter(child: SizedBox(height: 130)),
          ],
        );
      },
    );
  }

  List<_TasteMix> _buildTasteMixes() {
    final mixes = <_TasteMix>[];

    for (final cat in kCategories) {
      final catSongs = controller.songsForCategory(cat);
      if (catSongs.isEmpty) continue;
      final artists = catSongs
          .map((s) => s.artist)
          .where((a) => a.trim().isNotEmpty)
          .toSet()
          .take(3)
          .join(', ');
      mixes.add(
        _TasteMix(
          title: '$cat Mood Mix',
          subtitle: artists.isNotEmpty ? artists : '${catSongs.length} tracks',
          accent: moodColor(cat),
          imageUrl: catSongs.first.imageUrl,
          songs: catSongs,
        ),
      );
    }

    for (final artist in controller.topArtists.take(4)) {
      final artistSongs = controller.songs
          .where(
            (s) => s.artist.toLowerCase().contains(artist.toLowerCase()),
          )
          .toList();
      if (artistSongs.isEmpty) continue;
      final genres = controller.topGenres.take(2).join(' • ');
      mixes.add(
        _TasteMix(
          title: '$artist Mix',
          subtitle: genres.isNotEmpty
              ? '$artist • $genres'
              : '${artistSongs.length} tracks in library',
          accent: moodColor(artistSongs.first.category),
          imageUrl: artistSongs.first.imageUrl,
          songs: artistSongs,
        ),
      );
    }

    return mixes;
  }

  List<_ArtistAlbum> _buildArtistAlbums() {
    final orderedArtists = <String>[];
    final seen = <String>{};

    void addArtistsFrom(Iterable<Song> songs) {
      for (final song in songs) {
        for (final raw in song.artist.split(',')) {
          final name = raw.trim();
          if (name.isEmpty) continue;
          final lower = name.toLowerCase();
          if (seen.add(lower)) {
            orderedArtists.add(name);
          }
        }
      }
    }

    // Prioritize artists from the user's played and liked tracks first.
    addArtistsFrom(controller.mostPlayed);
    addArtistsFrom(controller.likedSongs);
    for (final artist in controller.topArtists) {
      final name = artist.trim();
      if (name.isNotEmpty && seen.add(name.toLowerCase())) {
        orderedArtists.add(name);
      }
    }

    final albums = <_ArtistAlbum>[];
    for (final artist in orderedArtists.take(10)) {
      final lower = artist.toLowerCase();
      final artistSongs = controller.songs
          .where((s) => s.artist.toLowerCase().contains(lower))
          .toList();
      if (artistSongs.isEmpty) continue;

      final imageUrl = artistSongs
          .map((s) => s.imageUrl)
          .whereType<String>()
          .where((u) => u.trim().isNotEmpty)
          .firstOrNull;

      albums.add(
        _ArtistAlbum(
          artistName: artist,
          accent: moodColor(artistSongs.first.category),
          imageUrl: imageUrl,
          songs: artistSongs,
        ),
      );
    }
    return albums;
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Text(
        title,
        style: TextStyle(
          color: SpotifyColors.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
      ),
    );
  }
}

class _QuickPickTile extends StatelessWidget {
  const _QuickPickTile({
    required this.title,
    required this.accent,
    required this.icon,
    required this.imageUrl,
    required this.onTap,
  });

  final String title;
  final Color accent;
  final IconData icon;
  final String? imageUrl;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim() ?? '';
    return Material(
      color: SpotifyColors.elevated,
      borderRadius: BorderRadius.circular(6),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Row(
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: url.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: url,
                      fit: BoxFit.cover,
                      placeholder: (_, _) => _iconBox(),
                      errorWidget: (_, _, _) => _iconBox(),
                    )
                  : _iconBox(),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: SpotifyColors.textPrimary,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _iconBox() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent,
            accent.withValues(alpha: 0.55),
          ],
        ),
      ),
      child: Icon(icon, color: Colors.white, size: 22),
    );
  }
}

class _TasteMix {
  const _TasteMix({
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.imageUrl,
    required this.songs,
  });

  final String title;
  final String subtitle;
  final Color accent;
  final String? imageUrl;
  final List<Song> songs;
}

class _TasteMixCard extends StatelessWidget {
  const _TasteMixCard({
    required this.mix,
    required this.onTap,
  });

  final _TasteMix mix;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final url = mix.imageUrl?.trim() ?? '';
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 146,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    width: 146,
                    height: 146,
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
                Positioned(
                  left: 8,
                  right: 8,
                  bottom: 8,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: SpotifyColors.surface.withValues(alpha: 0.92),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: mix.accent.withValues(alpha: 0.85),
                        ),
                      ),
                      child: Text(
                        mix.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: SpotifyColors.textPrimary,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              mix.subtitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: SpotifyColors.textSecondary,
                fontSize: 12,
                height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fallback() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            mix.accent.withValues(alpha: 0.8),
            SpotifyColors.elevated,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Icon(
        Icons.queue_music_rounded,
        size: 48,
        color: Colors.white,
      ),
    );
  }
}

class _SongShelfCard extends StatelessWidget {
  const _SongShelfCard({
    required this.song,
    required this.onTap,
  });

  final Song song;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final url = song.imageUrl?.trim() ?? '';
    final accent = moodColor(song.category);

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 136,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 136,
                height: 136,
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
            const SizedBox(height: 8),
            Text(
              song.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: SpotifyColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              song.artist,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: SpotifyColors.textSecondary,
                fontSize: 11.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fallback(Color accent) {
    return Container(
      color: SpotifyColors.elevated,
      child: Icon(
        Icons.music_note_rounded,
        color: accent,
        size: 42,
      ),
    );
  }
}

class _ArtistAlbum {
  const _ArtistAlbum({
    required this.artistName,
    required this.accent,
    required this.imageUrl,
    required this.songs,
  });

  final String artistName;
  final Color accent;
  final String? imageUrl;
  final List<Song> songs;
}

class _ArtistAlbumCard extends StatelessWidget {
  const _ArtistAlbumCard({
    required this.album,
    required this.onTap,
  });

  final _ArtistAlbum album;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final url = album.imageUrl?.trim() ?? '';
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 146,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 146,
                height: 146,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      album.accent.withValues(alpha: 0.78),
                      SpotifyColors.elevated,
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (url.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: url,
                        fit: BoxFit.cover,
                        errorWidget: (_, _, _) => SizedBox.shrink(),
                      )
                    else
                      Center(
                        child: Icon(
                          Icons.album_rounded,
                          color: SpotifyColors.textPrimary.withValues(alpha: 0.85),
                          size: 46,
                        ),
                      ),
                    Positioned(
                      right: 8,
                      bottom: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.65),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          'ALBUM',
                          style: TextStyle(
                            color: SpotifyColors.spotifyGreen,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${album.artistName} Mix',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: SpotifyColors.textPrimary,
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '${album.songs.length} saved • Tap for playlist',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: SpotifyColors.textSecondary,
                fontSize: 11.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
