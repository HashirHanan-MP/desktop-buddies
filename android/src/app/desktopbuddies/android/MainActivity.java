package app.desktopbuddies.android;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/*
 * Desktop Buddies — the launcher screen. Asks for "display over other apps",
 * then starts / stops the overlay service and jumps to its menu or home screen.
 */
public class MainActivity extends Activity {
    private TextView status;
    private Button startBtn, menuBtn, homeBtn, permBtn;
    private float dp;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        dp = getResources().getDisplayMetrics().density;
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = px(24);
        col.setPadding(pad, px(48), pad, pad);
        col.setBackgroundColor(Color.rgb(247, 245, 252));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        col.addView(logo, new LinearLayout.LayoutParams(px(96), px(96)));

        TextView title = text("Desktop Buddies", 26, Color.rgb(40, 30, 70));
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(0, px(12), 0, px(4));
        col.addView(title);
        TextView sub = text("A cat, Iron Man, Thor, Homelander, Hulk and Spider-Man living on top of your apps — with Thanos, Doom, Kang, Ultrons and Galactus to fight.", 15, Color.rgb(90, 85, 110));
        sub.setGravity(Gravity.CENTER);
        col.addView(sub);

        status = text("", 14, Color.rgb(90, 85, 110));
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, px(18), 0, px(6));
        col.addView(status);

        permBtn = button("Allow \"display over other apps\"", Color.rgb(230, 120, 40), v -> {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
            startActivity(i);
        });
        col.addView(permBtn);
        startBtn = button("Start buddies", Color.rgb(108, 72, 220), v -> {
            if (BuddyService.running) startService(new Intent(this, BuddyService.class).setAction(BuddyService.ACTION_STOP));
            else startForegroundService(new Intent(this, BuddyService.class));
            v.postDelayed(this::refresh, 400);
        });
        col.addView(startBtn);
        menuBtn = button("Open buddy menu", Color.rgb(60, 60, 80), v -> send(BuddyService.ACTION_MENU));
        col.addView(menuBtn);
        homeBtn = button("Home & settings", Color.rgb(60, 60, 80), v -> send(BuddyService.ACTION_HOME));
        col.addView(homeBtn);

        TextView tips = text("Tap a buddy to boop it · drag to pick it up · press and hold for its menu. "
                + "The notification has Menu, Home and Stop buttons.", 13, Color.rgb(120, 115, 140));
        tips.setGravity(Gravity.CENTER);
        tips.setPadding(0, px(18), 0, 0);
        col.addView(tips);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(247, 245, 252));
        scroll.addView(col);
        setContentView(scroll);
    }

    @Override protected void onResume() { super.onResume(); refresh(); }

    private void send(String action) {
        if (!BuddyService.running) startForegroundService(new Intent(this, BuddyService.class));
        Intent i = new Intent(this, BuddyService.class).setAction(action);
        startService(i);
        moveTaskToBack(true);   // show the buddies over the home screen
    }

    private void refresh() {
        boolean allowed = Settings.canDrawOverlays(this);
        boolean on = BuddyService.running;
        permBtn.setVisibility(allowed ? View.GONE : View.VISIBLE);
        startBtn.setEnabled(allowed);
        startBtn.setText(on ? "Stop buddies" : "Start buddies");
        menuBtn.setEnabled(allowed);
        homeBtn.setEnabled(allowed);
        status.setText(!allowed ? "First, let Desktop Buddies draw over other apps."
                : on ? "The buddies are out — go to any app and find them." : "Ready when you are.");
        startBtn.setAlpha(allowed ? 1f : 0.4f);
        menuBtn.setAlpha(allowed ? 1f : 0.4f);
        homeBtn.setAlpha(allowed ? 1f : 0.4f);
    }

    private int px(int v) { return Math.round(v * dp); }

    private TextView text(String s, int sp, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER_HORIZONTAL);
        return t;
    }

    private Button button(String label, int color, View.OnClickListener click) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setTextColor(Color.WHITE);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(color);
        bg.setCornerRadius(px(14));
        b.setBackground(bg);
        b.setOnClickListener(click);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, px(52));
        lp.topMargin = px(10);
        b.setLayoutParams(lp);
        return b;
    }
}
