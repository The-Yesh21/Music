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

public class MediaPlaybackService extends Service {

    private static final String CHANNEL_ID = "echotune_playback";
    private static final int NOTIFICATION_ID = 1;

    public static final String ACTION_PLAY   = "ACTION_PLAY";
    public static final String ACTION_PAUSE  = "ACTION_PAUSE";
    public static final String ACTION_NEXT   = "ACTION_NEXT";
    public static final String ACTION_PREV   = "ACTION_PREV";
    public static final String ACTION_STOP   = "ACTION_STOP";

    public static final String EXTRA_TITLE  = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_IS_PLAYING = "isPlaying";

    private MediaSessionCompat mediaSession;
    private String currentTitle  = "EchoTune";
    private String currentArtist = "";
    private boolean isPlaying    = false;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    private final IBinder binder = new LocalBinder();
    public class LocalBinder extends Binder {
        MediaPlaybackService getService() { return MediaPlaybackService.this; }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        mediaSession = new MediaSessionCompat(this, "EchoTuneSession");
        mediaSession.setActive(true);

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "EchoTune:PlaybackWakeLock");
                wakeLock.acquire();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "EchoTune:PlaybackWifiLock");
                wifiLock.acquire();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();

        // Update metadata from intent
        if (intent.hasExtra(EXTRA_TITLE))
            currentTitle = intent.getStringExtra(EXTRA_TITLE);
        if (intent.hasExtra(EXTRA_ARTIST))
            currentArtist = intent.getStringExtra(EXTRA_ARTIST);
        if (intent.hasExtra(EXTRA_IS_PLAYING))
            isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false);

        // Handle button actions — broadcast back to WebView
        if (action != null) {
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

        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    private Notification buildNotification() {
        // Pending intents for notification buttons
        PendingIntent playPauseIntent = buildActionIntent(isPlaying ? ACTION_PAUSE : ACTION_PLAY);
        PendingIntent nextIntent      = buildActionIntent(ACTION_NEXT);
        PendingIntent prevIntent      = buildActionIntent(ACTION_PREV);

        // Tap notification → open app
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openAppIntent = PendingIntent.getActivity(
            this, 0, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        mediaSession.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE,  currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .build());

        return new NotificationCompat.Builder(this, CHANNEL_ID)
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
                .setShowActionsInCompactView(0, 1, 2))
            .build();
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
                CHANNEL_ID,
                "EchoTune Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Music playback controls");
            channel.setSound(null, null);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return binder; }

    @Override
    public void onDestroy() {
        if (mediaSession != null) mediaSession.release();

        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        try {
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Send a final stop broadcast to ensure JS side is notified of termination
        try {
            Intent broadcast = new Intent("ECHOTUNE_MEDIA_ACTION");
            broadcast.putExtra("action", ACTION_STOP);
            sendBroadcast(broadcast);
        } catch (Exception e) {
            e.printStackTrace();
        }

        super.onDestroy();
    }
}
