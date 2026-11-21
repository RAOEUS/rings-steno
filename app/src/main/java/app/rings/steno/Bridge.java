package app.rings.steno;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.util.Collections;

/**
 * What the page can ask of the phone. The page sees it as window.RingsNative. One page is the app screen and another is
 * the keyboard; each has its own bridge, and only the keyboard's has a host.
 */
final class Bridge {
    /** Plover's answer about files that were shared to the app, waiting for the page to show it. */
    static volatile String addedFiles;

    private final Context context;
    private final WebView web;
    private final KeyboardHost keyboard;      // null on the app screen
    private final Haptics haptics;
    private final Handler main = new Handler(Looper.getMainLooper());
    private int padPx;      // height of the tape and pad at the bottom of the page

    Bridge(Context context, WebView web, KeyboardHost keyboard) {
        this.context = context;
        this.web = web;
        this.keyboard = keyboard;
        this.haptics = new Haptics(context);
        web.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> keepEdgesClear());
    }

    // ---- the engine

    @JavascriptInterface public String call(String method, String jsonArgs) {
        return Plover.call(context, method, jsonArgs);
    }

    /** One stroke. toEditor: type the result into the app being written in, not into the page. */
    @JavascriptInterface public String stroke(String jsonKeys, boolean toEditor) {
        String result = Plover.call(context, "stroke", "[" + jsonKeys + "]");
        if (toEditor && keyboard != null) main.post(() -> keyboard.type(result));
        return result;
    }

    // ---- the keyboard

    @JavascriptInterface public String mode() {
        return keyboard != null ? "ime" : "app";
    }

    /** The page has loaded and Plover is up. */
    @JavascriptInterface public void ready() {
        if (keyboard != null) main.post(keyboard::fieldChanged);
    }

    /** The height of the tape and pad in CSS pixels. */
    @JavascriptInterface public void height(int cssPx) {
        main.post(() -> {
            padPx = Math.round(cssPx * context.getResources().getDisplayMetrics().density);
            if (keyboard != null) keyboard.setKeyboardHeight(cssPx);
            keepEdgesClear();
        });
    }

    @JavascriptInterface public int navInset() {
        return keyboard == null ? 0 : keyboard.navInsetCss();
    }

    /**
     * A push that starts beside the screen's edge must reach the stick, not be taken as the phone's Back swipe. Android
     * lets an app claim up to 200dp of each edge; the pad is the part that needs it.
     */
    private void keepEdgesClear() {
        if (padPx <= 0 || web.getWidth() == 0) return;
        web.setSystemGestureExclusionRects(Collections.singletonList(new Rect(0, Math.max(0, web.getHeight() - padPx), web.getWidth(), web.getHeight())));
    }

    // ---- the phone

    @JavascriptInterface public void haptic(String kind, int strength) {
        haptics.play(kind, strength);
    }

    /** Is the phone in its dark theme? The page follows it. */
    @JavascriptInterface public boolean night() {
        return (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    @JavascriptInterface public void copy(String text) {
        main.post(() -> context.getSystemService(ClipboardManager.class).setPrimaryClip(ClipData.newPlainText("Rings", text)));
    }

    @JavascriptInterface public String takeAdded() {
        String answer = addedFiles;
        addedFiles = null;
        return answer;
    }

    // ---- getting between the keyboard, the app and the phone's settings

    @JavascriptInterface public void openApp(String panel) {
        context.startActivity(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra(MainActivity.PANEL, panel));
    }

    @JavascriptInterface public void pickKeyboard() {
        main.post(() -> context.getSystemService(InputMethodManager.class).showInputMethodPicker());
    }

    @JavascriptInterface public void keyboardSettings() {
        context.startActivity(new Intent(Settings.ACTION_INPUT_METHOD_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }

    /** off: not switched on in the phone's settings. on: switched on but another keyboard is in use. current: in use. */
    @JavascriptInterface public String keyboardState() {
        String me = context.getPackageName();
        String current = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.DEFAULT_INPUT_METHOD);
        if (current != null && current.startsWith(me + "/")) return "current";
        for (InputMethodInfo info : context.getSystemService(InputMethodManager.class).getEnabledInputMethodList())
            if (info.getPackageName().equals(me)) return "on";
        return "off";
    }
}
