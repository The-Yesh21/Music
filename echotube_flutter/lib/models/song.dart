const List<String> kCategories = ['Happy', 'Lonely', 'Enjoyment'];

enum AudioQuality {
  high(320, '320 kbps', 'Best Quality'),
  balanced(160, '160 kbps', 'Balanced'),
  saver(96, '96 kbps', 'Data Saver');

  const AudioQuality(this.bitrate, this.shortLabel, this.description);

  final int bitrate;
  final String shortLabel;
  final String description;
}

class Song {
  const Song({
    required this.songKey,
    required this.title,
    required this.artist,
    required this.mood,
    required this.genre,
    required this.category,
    this.imageUrl,
    this.streamUrl,
    this.localAudioPath,
    this.apiId,
    this.isNew = false,
    this.isCustom = false,
    this.isRemoved = false,
    this.isLiked = false,
    this.playCount = 0,
    this.lastPlayedAt,
    required this.createdAt,
    this.pendingSync = false,
  });

  final String songKey;
  final String title;
  final String artist;
  final String mood;
  final String genre;
  final String category;
  final String? imageUrl;
  final String? streamUrl;
  final String? localAudioPath;
  final String? apiId;
  final bool isNew;
  final bool isCustom;
  final bool isRemoved;
  final bool isLiked;
  final int playCount;
  final int? lastPlayedAt;
  final int createdAt;
  final bool pendingSync;

  static String computeKey(String title, String artist) =>
      '${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}';

  bool get isDownloaded =>
      localAudioPath != null && localAudioPath!.isNotEmpty;

  Song copyWith({
    String? songKey,
    String? title,
    String? artist,
    String? mood,
    String? genre,
    String? category,
    String? imageUrl,
    bool clearImageUrl = false,
    String? streamUrl,
    bool clearStreamUrl = false,
    String? localAudioPath,
    bool clearLocalAudioPath = false,
    String? apiId,
    bool clearApiId = false,
    bool? isNew,
    bool? isCustom,
    bool? isRemoved,
    bool? isLiked,
    int? playCount,
    int? lastPlayedAt,
    bool clearLastPlayedAt = false,
    int? createdAt,
    bool? pendingSync,
  }) {
    return Song(
      songKey: songKey ?? this.songKey,
      title: title ?? this.title,
      artist: artist ?? this.artist,
      mood: mood ?? this.mood,
      genre: genre ?? this.genre,
      category: category ?? this.category,
      imageUrl: clearImageUrl ? null : (imageUrl ?? this.imageUrl),
      streamUrl: clearStreamUrl ? null : (streamUrl ?? this.streamUrl),
      localAudioPath:
          clearLocalAudioPath ? null : (localAudioPath ?? this.localAudioPath),
      apiId: clearApiId ? null : (apiId ?? this.apiId),
      isNew: isNew ?? this.isNew,
      isCustom: isCustom ?? this.isCustom,
      isRemoved: isRemoved ?? this.isRemoved,
      isLiked: isLiked ?? this.isLiked,
      playCount: playCount ?? this.playCount,
      lastPlayedAt:
          clearLastPlayedAt ? null : (lastPlayedAt ?? this.lastPlayedAt),
      createdAt: createdAt ?? this.createdAt,
      pendingSync: pendingSync ?? this.pendingSync,
    );
  }

  factory Song.fromCatalogJson(Map<String, dynamic> json) {
    final title = (json['Title'] as String? ?? '').trim();
    final artist = (json['Artist'] as String? ?? '').trim();
    final category = (json['Category'] as String? ?? 'Happy').trim();
    return Song(
      songKey: computeKey(title, artist),
      title: title,
      artist: artist,
      mood: (json['Mood'] as String? ?? '').trim(),
      genre: (json['Genre'] as String? ?? '').trim(),
      category: category.isEmpty ? 'Happy' : category,
      imageUrl: _nonEmptyOrNull(json['image'] as String?),
      streamUrl: _nonEmptyOrNull(json['streamUrl'] as String?),
      apiId: _nonEmptyOrNull(json['apiId'] as String?),
      isNew: json['isNew'] == true,
      createdAt: (json['createdAt'] as int?) ??
          DateTime.now().millisecondsSinceEpoch,
    );
  }

  Map<String, dynamic> toCloudJson() {
    final data = <String, dynamic>{
      'Title': title,
      'Artist': artist,
      'Category': category,
      'Mood': mood,
      'Genre': genre,
      'image': imageUrl,
      'streamUrl': streamUrl,
      'isNew': isNew,
    };
    if (apiId != null) {
      data['apiId'] = apiId;
    }
    return data;
  }

  factory Song.fromDbMap(Map<String, dynamic> map) {
    return Song(
      songKey: map['song_key'] as String,
      title: map['title'] as String,
      artist: map['artist'] as String,
      mood: (map['mood'] as String?) ?? '',
      genre: (map['genre'] as String?) ?? '',
      category: map['category'] as String,
      imageUrl: map['image_url'] as String?,
      streamUrl: map['stream_url'] as String?,
      localAudioPath: map['local_audio_path'] as String?,
      apiId: map['api_id'] as String?,
      isNew: (map['is_new'] as int? ?? 0) == 1,
      isCustom: (map['is_custom'] as int? ?? 0) == 1,
      isRemoved: (map['is_removed'] as int? ?? 0) == 1,
      isLiked: (map['is_liked'] as int? ?? 0) == 1,
      playCount: map['play_count'] as int? ?? 0,
      lastPlayedAt: map['last_played_at'] as int?,
      createdAt: map['created_at'] as int,
      pendingSync: (map['pending_sync'] as int? ?? 0) == 1,
    );
  }

  Map<String, dynamic> toDbMap() {
    return {
      'song_key': songKey,
      'title': title,
      'artist': artist,
      'mood': mood,
      'genre': genre,
      'category': category,
      'image_url': imageUrl,
      'stream_url': streamUrl,
      'local_audio_path': localAudioPath,
      'api_id': apiId,
      'is_new': isNew ? 1 : 0,
      'is_custom': isCustom ? 1 : 0,
      'is_removed': isRemoved ? 1 : 0,
      'is_liked': isLiked ? 1 : 0,
      'play_count': playCount,
      'last_played_at': lastPlayedAt,
      'created_at': createdAt,
      'pending_sync': pendingSync ? 1 : 0,
    };
  }

  static String? _nonEmptyOrNull(String? value) {
    if (value == null) return null;
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Song &&
        other.songKey == songKey &&
        other.title == title &&
        other.artist == artist &&
        other.mood == mood &&
        other.genre == genre &&
        other.category == category &&
        other.imageUrl == imageUrl &&
        other.streamUrl == streamUrl &&
        other.localAudioPath == localAudioPath &&
        other.apiId == apiId &&
        other.isNew == isNew &&
        other.isCustom == isCustom &&
        other.isRemoved == isRemoved &&
        other.isLiked == isLiked &&
        other.playCount == playCount &&
        other.lastPlayedAt == lastPlayedAt &&
        other.createdAt == createdAt &&
        other.pendingSync == pendingSync;
  }

  @override
  int get hashCode => Object.hash(
        songKey,
        title,
        artist,
        mood,
        genre,
        category,
        imageUrl,
        streamUrl,
        localAudioPath,
        apiId,
        isNew,
        isCustom,
        isRemoved,
        isLiked,
        playCount,
        lastPlayedAt,
        createdAt,
        pendingSync,
      );
}
