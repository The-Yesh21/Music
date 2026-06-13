package com.echotune.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.support.v4.media.MediaMetadataCompat;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import android.os.PowerManager;
import android.net.wifi.WifiManager;
import android.content.Context;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MediaPlaybackService extends Service {

    private static final String CHANNEL_ID      = "echotune_playback";
    private static final int    NOTIFICATION_ID  = 1;
    private static final int    ARTWORK_SIZE_PX  = 512; // max bitmap dimension

    public static final String ACTION_PLAY  = "ACTION_PLAY";
    public static final String ACTION_PAUSE = "ACTION_PAUSE";
    public static final String ACTION_NEXT  = "ACTION_NEXT";
    public static final String ACTION_PREV  = "ACTION_PREV";
    public static final String ACTION_STOP  = "ACTION_STOP";

    public static final String EXTRA_TITLE      = "title";
    public static final String EXTRA_ARTIST     = "artist";
    public static final String EXTRA_ARTWORK    = "artwork";   // new: album art URL
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_POSITION   = "position";
    public static final String EXTRA_DURATION   = "duration";

    private MediaSessionCompat mediaSession;
    private String  currentTitle      = "EchoTune";
    private String  currentArtist     = "";
    private String  currentArtworkUrl = "";
    private Bitmap  currentArtworkBitmap = null;
    private boolean isPlaying         = false;
    private long    currentPosition   = 0;
    private long    currentDuration   = 0;

    private PowerManager.WakeLock wifiLockWorkaround;  // field name kept for compat
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock  wifiLock;

    private final IBinder binder = new LocalBinder();
    public class LocalBinder extends Binder {
        MediaPlaybackService getService() { return MediaPlaybackService.this; }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        mediaSession = new MediaSessionCompat(this, "EchoTuneSession");
        mediaSession.setActive(true);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay()           { sendBroadcastAction(ACTION_PLAY);  isPlaying = true;  refreshNotification(); }
            @Override public void onPause()          { sendBroadcastAction(ACTION_PAUSE); isPlaying = false; refreshNotification(); }
            @Override public void onSkipToNext()     { sendBroadcastAction(ACTION_NEXT); }
            @Override public void onSkipToPrevious() { sendBroadcastAction(ACTION_PREV); }
            @Override public void onSeekTo(long pos) {
                currentPosition = pos;
                Intent broadcast = new Intent("ECHOTUNE_MEDIA_ACTION");
                broadcast.putExtra("action", "ACTION_SEEK_TO");
                broadcast.putExtra("position", pos);
                sendBroadcast(broadcast);
                updatePlaybackState();
                refreshNotification();
            }
        });

        acquireWakeLocks();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();

        // ── Update metadata if provided ──────────────────────────────────────
        if (intent.hasExtra(EXTRA_TITLE))       currentTitle    = intent.getStringExtra(EXTRA_TITLE);
        if (intent.hasExtra(EXTRA_ARTIST))      currentArtist   = intent.getStringExtra(EXTRA_ARTIST);
        if (intent.hasExtra(EXTRA_IS_PLAYING))  isPlaying       = intent.getBooleanExtra(EXTRA_IS_PLAYING, false);
        if (intent.hasExtra(EXTRA_POSITION))    currentPosition = intent.getLongExtra(EXTRA_POSITION, 0L);
        if (intent.hasExtra(EXTRA_DURATION))    currentDuration = intent.getLongExtra(EXTRA_DURATION, 0L);

        // ── Artwork: fetch in background only when URL changes ────────────────
        if (intent.hasExtra(EXTRA_ARTWORK)) {
            String newUrl = intent.getStringExtra(EXTRA_ARTWORK);
            if (newUrl != null && !newUrl.equals(currentArtworkUrl)) {
                currentArtworkUrl    = newUrl;
                currentArtworkBitmap = null;   // invalidate cache immediately
                loadArtworkAsync(newUrl);
            }
        }

        // ── Handle button actions from notification ────────────────────────────
        if (action != null) {
            // Relay to WebView via broadcast (MediaPlugin listens for this)
            Intent broadcast = new Intent("ECHOTUNE_MEDIA_ACTION");
            broadcast.putExtra("action", action);
            sendBroadcast(broadcast);

            if (ACTION_STOP.equals(action)) {
                stopForeground(true);
                stopSelf();
                return START_NOT_STICKY;
            }
            if (ACTION_PLAY.equals(action))  isPlaying = true;
            if (ACTION_PAUSE.equals(action)) isPlaying = false;
        }

        updatePlaybackState();
        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return binder; }

    @Override
    public void onDestroy() {
        if (mediaSession != null) mediaSession.release();
        releaseWakeLocks();

        // Notify JS that the service terminated
        try {
            Intent b = new Intent("ECHOTUNE_MEDIA_ACTION");
            b.putExtra("action", ACTION_STOP);
            sendBroadcast(b);
        } catch (Exception ignored) {}

        super.onDestroy();
    }

    // ─── Notification ─────────────────────────────────────────────────────────

    private Notification buildNotification() {
        PendingIntent playPauseIntent = buildActionIntent(isPlaying ? ACTION_PAUSE : ACTION_PLAY);
        PendingIntent nextIntent      = buildActionIntent(ACTION_NEXT);
        PendingIntent prevIntent      = buildActionIntent(ACTION_PREV);

        // Tap → open app
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openAppIntent = PendingIntent.getActivity(
            this, 0, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // ── MediaSession metadata (enables system seek bar on Android 10+) ────
        mediaSession.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE,   currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST,  currentArtist)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION,  currentDuration)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtworkBitmap)
            .build()
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(openAppIntent)
            .setOngoing(isPlaying)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(R.drawable.ic_skip_previous, "Prev", prevIntent)
            .addAction(isPlaying ? R.drawable.ic_pause : R.drawable.ic_play,
                       isPlaying ? "Pause" : "Play", playPauseIntent)
            .addAction(R.drawable.ic_skip_next, "Next", nextIntent)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));

        // Album art as large icon
        if (currentArtworkBitmap != null) {
            builder.setLargeIcon(currentArtworkBitmap);
        }

        // ── Explicit progress bar as a fallback for older Android versions ────
        // Android 10+ infers progress from PlaybackState, but older versions
        // need NotificationCompat.setProgress() to display a seek bar.
        if (currentDuration > 0) {
            int maxProgress = 1000;
            int curProgress = (int) (((double) currentPosition / currentDuration) * maxProgress);
            builder.setProgress(maxProgress, curProgress, false);
        }

        return builder.build();
    }

    /** Rebuild and push the notification without re-starting the service. */
    private void refreshNotification() {
        updatePlaybackState();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
    }

    private PendingIntent buildActionIntent(String action) {
        Intent i = new Intent(this, MediaPlaybackService.class);
        i.setAction(action);
        return PendingIntent.getService(
            this, action.hashCode(), i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "EchoTune Playback", NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Music playback controls");
            channel.setSound(null, null);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    // ─── Artwork loading ──────────────────────────────────────────────────────

    /**
     * Download album art from {@code url} on a background thread.
     * When done, caches the bitmap and rebuilds the notification.
     * The download is abandoned if the URL changes before it completes.
     */
    private void loadArtworkAsync(final String url) {
        if (url == null || url.isEmpty()) return;
        new Thread(() -> {
            try {
                URL imageUrl = new URL(url);
                HttpURLConnection conn = (HttpURLConnection) imageUrl.openConnection();
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.setDoInput(true);
                conn.connect();

                InputStream inputStream = conn.getInputStream();

                // Decode a downscaled version to keep memory usage low
                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inJustDecodeBounds    = true;
                BitmapFactory.decodeStream(inputStream, null, opts);
                inputStream.close();

                // Re-open to decode with the calculated sample size
                conn = (HttpURLConnection) imageUrl.openConnection();
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.connect();
                inputStream = conn.getInputStream();

                opts.inSampleSize     = calculateInSampleSize(opts, ARTWORK_SIZE_PX, ARTWORK_SIZE_PX);
                opts.inJustDecodeBounds = false;
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream, null, opts);
                inputStream.close();

                // Only cache if the URL hasn't changed while we were downloading
                if (bitmap != null && url.equals(currentArtworkUrl)) {
                    currentArtworkBitmap = bitmap;
                    refreshNotification();   // push updated notification with art
                }
            } catch (Exception e) {
                // Artwork load failure is non-fatal — notification still works
            }
        }).start();
    }

    private static int calculateInSampleSize(BitmapFactory.Options options, int reqWidth, int reqHeight) {
        final int height = options.outHeight;
        final int width  = options.outWidth;
        int inSampleSize = 1;
        if (height > reqHeight || width > reqWidth) {
            final int halfHeight = height / 2;
            final int halfWidth  = width  / 2;
            while ((halfHeight / inSampleSize) >= reqHeight
                && (halfWidth  / inSampleSize) >= reqWidth) {
                inSampleSize *= 2;
            }
        }
        return inSampleSize;
    }

    // ─── PlaybackState ────────────────────────────────────────────────────────

    private void updatePlaybackState() {
        long actions = PlaybackStateCompat.ACTION_PLAY
                     | PlaybackStateCompat.ACTION_PAUSE
                     | PlaybackStateCompat.ACTION_PLAY_PAUSE
                     | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                     | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                     | PlaybackStateCompat.ACTION_SEEK_TO;

        int   state        = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        float playbackRate = isPlaying ? 1.0f : 0f;

        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions)
            // position + rate lets Android auto-interpolate progress on lock screen
            .setState(state, currentPosition, playbackRate)
            .build()
        );
    }

    // ─── Broadcast helper ─────────────────────────────────────────────────────

    private void sendBroadcastAction(String action) {
        Intent broadcast = new Intent("ECHOTUNE_MEDIA_ACTION");
        broadcast.putExtra("action", action);
        sendBroadcast(broadcast);
    }

    // ─── Wake/WiFi locks ──────────────────────────────────────────────────────

    private void acquireWakeLocks() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "EchoTune:PlaybackWakeLock");
                wakeLock.acquire();
            }
        } catch (Exception ignored) {}

        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "EchoTune:PlaybackWifiLock");
                wifiLock.acquire();
            }
        } catch (Exception ignored) {}
    }

    private void releaseWakeLocks() {
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
        try { if (wifiLock != null && wifiLock.isHeld()) wifiLock.release(); } catch (Exception ignored) {}
    }
}
