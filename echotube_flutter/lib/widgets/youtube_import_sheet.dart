import 'package:flutter/material.dart';

import '../models/song.dart';
import '../services/youtube_playlist_service.dart';
import '../state/app_controller.dart';
import '../theme/spotify_theme.dart';

Future<void> showYouTubeImportSheet(
  BuildContext context,
  AppController controller,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: SpotifyColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _YouTubeImportSheet(controller: controller),
  );
}

class _YouTubeImportSheet extends StatefulWidget {
  const _YouTubeImportSheet({required this.controller});

  final AppController controller;

  @override
  State<_YouTubeImportSheet> createState() => _YouTubeImportSheetState();
}

class _YouTubeImportSheetState extends State<_YouTubeImportSheet> {
  final TextEditingController _urlController = TextEditingController();
  bool _isFetching = false;
  bool _isImporting = false;
  int _importedCount = 0;
  int _importTotal = 0;
  String? _error;
  String _selectedCategory = 'Happy';

  List<YouTubePlaylistTrack> _tracks = const [];
  Set<String> _duplicateKeys = const {};
  Set<String> _selectedKeys = {};

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _fetchPlaylist() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) {
      setState(() => _error = 'Paste a YouTube playlist link first.');
      return;
    }

    setState(() {
      _isFetching = true;
      _error = null;
      _tracks = const [];
      _duplicateKeys = const {};
      _selectedKeys = {};
    });

    try {
      final fetched =
          await YouTubePlaylistService.instance.fetchPlaylistTracks(url);
      final allExisting =
          await widget.controller.db.getAllSongs(includeRemoved: true);

      final dupes = <String>{};
      final selected = <String>{};
      for (final track in fetched) {
        if (YouTubePlaylistService.isDuplicateTrack(track, allExisting)) {
          dupes.add(track.songKey);
        } else {
          selected.add(track.songKey);
        }
      }

      if (!mounted) return;
      setState(() {
        _tracks = fetched;
        _duplicateKeys = dupes;
        _selectedKeys = selected;
        _isFetching = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Bad state: ', '');
        _isFetching = false;
      });
    }
  }

  Future<void> _importSelected() async {
    final toImport =
        _tracks.where((t) => _selectedKeys.contains(t.songKey)).toList();
    if (toImport.isEmpty || _isImporting) return;

    setState(() {
      _isImporting = true;
      _importedCount = 0;
      _importTotal = toImport.length;
    });

    final added = await widget.controller.importYouTubeTracks(
      toImport,
      _selectedCategory,
      onProgress: (done, total) {
        if (!mounted) return;
        setState(() {
          _importedCount = done;
          _importTotal = total;
        });
      },
    );

    if (!mounted) return;
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          added > 0
              ? 'Added $added new song${added == 1 ? '' : 's'} to $_selectedCategory (top of list)'
              : 'All selected songs were already in your library.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final newCount = _tracks.length - _duplicateKeys.length;

    return Padding(
      padding: EdgeInsets.fromLTRB(18, 16, 18, 18 + bottomInset),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.78,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.playlist_add_rounded,
                  color: SpotifyColors.orangeAccent,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Import YouTube Playlist',
                    style: TextStyle(
                      color: SpotifyColors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(
                    Icons.close_rounded,
                    color: SpotifyColors.textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _urlController,
                    style: TextStyle(color: SpotifyColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: 'Paste YouTube playlist URL...',
                      hintStyle: TextStyle(color: SpotifyColors.textSecondary),
                      filled: true,
                      fillColor: SpotifyColors.elevated,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    onSubmitted: (_) => _fetchPlaylist(),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: SpotifyColors.orangeAccent,
                    foregroundColor: SpotifyColors.onAccent,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                  ),
                  onPressed: _isFetching || _isImporting ? null : _fetchPlaylist,
                  child: _isFetching
                      ? SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: SpotifyColors.onAccent,
                          ),
                        )
                      : const Text(
                          'Fetch',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 13),
              ),
            ],
            if (_tracks.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${_tracks.length} found • ${_duplicateKeys.length} already in library • $newCount new',
                      style: TextStyle(
                        color: SpotifyColors.textSecondary,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: kCategories.map((cat) {
                  final selected = _selectedCategory == cat;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(cat),
                      selected: selected,
                      showCheckmark: false,
                      onSelected: (_) =>
                          setState(() => _selectedCategory = cat),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: ListView.builder(
                  itemCount: _tracks.length,
                  itemBuilder: (_, index) {
                    final track = _tracks[index];
                    final isDupe = _duplicateKeys.contains(track.songKey);
                    final isChecked = _selectedKeys.contains(track.songKey);

                    return CheckboxListTile(
                      value: isChecked,
                      activeColor: SpotifyColors.orangeAccent,
                      controlAffinity: ListTileControlAffinity.leading,
                      onChanged: isDupe || _isImporting
                          ? null
                          : (val) {
                              setState(() {
                                if (val == true) {
                                  _selectedKeys.add(track.songKey);
                                } else {
                                  _selectedKeys.remove(track.songKey);
                                }
                              });
                            },
                      title: Text(
                        track.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isDupe
                              ? SpotifyColors.textSecondary
                              : SpotifyColors.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      subtitle: Text(
                        isDupe
                            ? '${track.artist} • Already in library'
                            : track.artist,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isDupe
                              ? SpotifyColors.orangeAccent
                              : SpotifyColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: SpotifyColors.orangeAccent,
                    foregroundColor: SpotifyColors.onAccent,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: _selectedKeys.isEmpty || _isImporting
                      ? null
                      : _importSelected,
                  icon: _isImporting
                      ? SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: SpotifyColors.onAccent,
                          ),
                        )
                      : const Icon(Icons.download_done_rounded),
                  label: Text(
                    _isImporting
                        ? 'Importing $_importedCount / $_importTotal...'
                        : 'Add ${_selectedKeys.length} New Song${_selectedKeys.length == 1 ? '' : 's'} to $_selectedCategory',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ] else if (!_isFetching) ...[
              const SizedBox(height: 28),
              Center(
                child: Text(
                  'Paste any public YouTube playlist link.\nExisting songs across all moods will be automatically skipped.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: SpotifyColors.textSecondary,
                    fontSize: 13.5,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
