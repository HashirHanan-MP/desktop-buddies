package app.desktopbuddies.android;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/*
 * Desktop Buddies — the overlay. A full-screen transparent WebView runs the
 * buddies (src/mobile/index.html: the same simulation and drawings as the
 * desktop app) on top of every app. Touches pass straight through it to the
 * apps underneath ("hit" mode), except on a small invisible window that follows
 * the character; while a menu, a panel, a toy or the home screen is open the
 * WebView takes the touches itself ("full"/"focus" mode).
 */
public class BuddyService extends Service {
    public static final String ACTION_MENU = "app.desktopbuddies.MENU";
    public static final String ACTION_HOME = "app.desktopbuddies.HOME";
    public static final String ACTION_STOP = "app.desktopbuddies.STOP";
    static volatile boolean running = false;

    private static final int FG_ID = 1;
    private static final String CH_SERVICE = "service", CH_REMIND = "reminders";
    // Android 12+ only lets touches fall through an overlay that is at most 80% opaque
    private static final float PASS_THROUGH_ALPHA = 0.8f;

    private WindowManager wm;
    private BuddyWebView web;
    private View hit;
    private WindowManager.LayoutParams webLp, hitLp;
    private Handler ui;
    private TextToSpeech tts;
    private float density;
    private int notifySeq = 100;
    private String mode = "";
    private boolean loaded = false;
    private final java.util.ArrayList<String> pending = new java.util.ArrayList<>();

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        ui = new Handler(Looper.getMainLooper());
        density = getResources().getDisplayMetrics().density;
        createChannels();
        if (Build.VERSION.SDK_INT >= 34) startForeground(FG_ID, serviceNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(FG_ID, serviceNotification());
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        tts = new TextToSpeech(this, status -> { });
        createOverlay();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String a = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(a)) { shutdown(); return START_NOT_STICKY; }
        if (ACTION_MENU.equals(a)) js("BuddyHost.menu()");
        if (ACTION_HOME.equals(a)) js("BuddyHost.home()");
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (web != null) {
            try { wm.removeView(web); } catch (Exception ignored) { }
            web.destroy();
            web = null;
        }
        if (hit != null) { try { wm.removeView(hit); } catch (Exception ignored) { } hit = null; }
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }

    // save the buddies' state, then stop
    private void shutdown() {
        if (web == null) { stopSelf(); return; }
        web.evaluateJavascript("BuddyHost.save()", v -> ui.postDelayed(this::stopSelf, 150));
    }

    private int overlayType() { return WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY; }

    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    private void createOverlay() {
        web = new BuddyWebView(this);
        web.setBackgroundColor(Color.TRANSPARENT);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView v, String url) {
                loaded = true;
                for (String code : pending) v.evaluateJavascript(code, null);
                pending.clear();
            }
        });
        // a service can't show Android's dialogs; the pages use in-page sheets instead
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView v, String url, String msg, android.webkit.JsResult r) { r.confirm(); return true; }
            @Override public boolean onJsConfirm(WebView v, String url, String msg, android.webkit.JsResult r) { r.cancel(); return true; }
            @Override public boolean onJsPrompt(WebView v, String url, String msg, String def, android.webkit.JsPromptResult r) { r.cancel(); return true; }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        webLp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT, overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT);
        webLp.gravity = Gravity.TOP | Gravity.START;
        webLp.alpha = PASS_THROUGH_ALPHA;
        if (Build.VERSION.SDK_INT >= 28) webLp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        wm.addView(web, webLp);
        web.loadUrl("file:///android_asset/www/mobile/index.html");

        // the invisible window over the character: its touches go to the page
        hit = new View(this);
        hit.setBackgroundColor(Color.TRANSPARENT);
        hit.setOnTouchListener((v, e) -> {
            String type;
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN: type = "down"; break;
                case MotionEvent.ACTION_MOVE: type = "move"; break;
                case MotionEvent.ACTION_UP: type = "up"; break;
                case MotionEvent.ACTION_CANCEL: type = "cancel"; break;
                default: return true;
            }
            float x = e.getRawX() / density, y = e.getRawY() / density;
            js("BuddyHost.touch('" + type + "'," + x + "," + y + ")");
            return true;
        });
        hitLp = new WindowManager.LayoutParams(1, 1, overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        hitLp.gravity = Gravity.TOP | Gravity.START;
        wm.addView(hit, hitLp);
    }

    private void js(String code) {
        // menu/home taps from the notification can arrive before the page has loaded
        ui.post(() -> {
            if (web == null) return;
            if (loaded) web.evaluateJavascript(code, null);
            else if (!code.startsWith("BuddyHost.touch")) pending.add(code);
        });
    }

    // hit: touches fall through except over the character; full: the page takes every touch;
    // focus: also the keyboard (home screen text fields) and the back button
    private void setTouch(String m, int x, int y, int w, int h) {
        if (web == null) return;
        int f = webLp.flags;
        if ("hit".equals(m)) {
            f |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
            webLp.alpha = PASS_THROUGH_ALPHA;
        } else if ("full".equals(m)) {
            f &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
            f |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
            webLp.alpha = 1f;
        } else {
            f &= ~(WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
            webLp.alpha = 1f;
        }
        if (f != webLp.flags || !m.equals(mode)) {
            webLp.flags = f;
            try { wm.updateViewLayout(web, webLp); } catch (Exception ignored) { }
        }
        mode = m;
        // the touch window is never removed, only shrunk and made untouchable while unused
        if ("hit".equals(m) && w > 0 && h > 0) {
            hitLp.x = Math.round(x * density); hitLp.y = Math.round(y * density);
            hitLp.width = Math.max(1, Math.round(w * density)); hitLp.height = Math.max(1, Math.round(h * density));
            hitLp.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        } else if ((hitLp.flags & WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE) == 0) {
            hitLp.width = 1; hitLp.height = 1;
            hitLp.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        } else return;
        try { wm.updateViewLayout(hit, hitLp); } catch (Exception ignored) { }
    }

    private int dimenDp(String name) {
        int id = getResources().getIdentifier(name, "dimen", "android");
        return id > 0 ? Math.round(getResources().getDimensionPixelSize(id) / density) : 0;
    }

    // ------------------------------------------------------------ notifications
    private void createChannels() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CH_SERVICE, "Buddies on screen", NotificationManager.IMPORTANCE_LOW));
        NotificationChannel r = new NotificationChannel(CH_REMIND, "Reminders & news", NotificationManager.IMPORTANCE_HIGH);
        nm.createNotificationChannel(r);
    }

    private PendingIntent servicePending(String action, int code) {
        Intent i = new Intent(this, BuddyService.class).setAction(action);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private Notification serviceNotification() {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CH_SERVICE)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Desktop Buddies are on your screen")
                .setContentText("Tap a buddy to boop it, drag to pick it up, press and hold for its menu.")
                .setContentIntent(open)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(null, "Menu", servicePending(ACTION_MENU, 1)).build())
                .addAction(new Notification.Action.Builder(null, "Home", servicePending(ACTION_HOME, 2)).build())
                .addAction(new Notification.Action.Builder(null, "Stop", servicePending(ACTION_STOP, 3)).build())
                .build();
    }

    // ------------------------------------------------------------ what the page may ask for
    private class Bridge {
        @JavascriptInterface public String insets() {
            return "{\"top\":" + dimenDp("status_bar_height") + ",\"bottom\":" + dimenDp("navigation_bar_height") + "}";
        }

        @JavascriptInterface public void setTouch(String m, int x, int y, int w, int h) {
            ui.post(() -> BuddyService.this.setTouch(m, x, y, w, h));
        }

        @JavascriptInterface public void notify(String title, String body) {
            Context c = BuddyService.this;
            PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
            Notification n = new Notification.Builder(c, CH_REMIND)
                    .setSmallIcon(R.drawable.ic_stat)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new Notification.BigTextStyle().bigText(body))
                    .setContentIntent(open)
                    .setAutoCancel(true)
                    .build();
            getSystemService(NotificationManager.class).notify(notifySeq++, n);
        }

        @JavascriptInterface public void speak(String text, float pitch, float rate) {
            if (tts == null) return;
            tts.setPitch(Math.max(0.3f, Math.min(2f, pitch)));
            tts.setSpeechRate(Math.max(0.5f, Math.min(2f, rate)));
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "buddy");
        }

        @JavascriptInterface public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null) v.vibrate(VibrationEffect.createOneShot(Math.max(5, ms), VibrationEffect.DEFAULT_AMPLITUDE));
        }

        @JavascriptInterface public void stop() { ui.post(BuddyService.this::shutdown); }
    }

    // the back button closes the home screen / menu while the overlay has focus
    private class BuddyWebView extends WebView {
        BuddyWebView(Context c) { super(c); }

        @Override
        public boolean dispatchKeyEvent(KeyEvent e) {
            if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) {
                if (e.getAction() == KeyEvent.ACTION_UP) evaluateJavascript("BuddyHost.back()", null);
                return true;
            }
            return super.dispatchKeyEvent(e);
        }
    }
}
