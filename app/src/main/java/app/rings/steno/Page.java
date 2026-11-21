package app.rings.steno;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.webkit.WebSettings;
import android.webkit.WebView;

/** The interface: one web page (src/main/assets/ui), shown whole on the app screen and as tape and pad in the keyboard. */
final class Page {
    static final String URL = "file:///android_asset/ui/index.html";

    private Page() {}

    /** A view showing the page, wired to the phone. keyboard: who types for it, or null on the app screen. */
    @SuppressLint("SetJavaScriptEnabled")
    static WebView open(Context context, KeyboardHost keyboard) {
        boolean debuggable = (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (debuggable) WebView.setWebContentsDebuggingEnabled(true);      // lets a computer inspect the page over adb

        WebView web = new WebView(context);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);      // the page keeps the settings in IndexedDB
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setTextZoom(100);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);      // no text-selection popups over the sticks
        if (keyboard != null) web.setBackgroundColor(Color.TRANSPARENT);      // the app shows through above the keyboard

        web.addJavascriptInterface(new Bridge(context, web, keyboard), "RingsNative");
        web.loadUrl(URL);
        return web;
    }

    /** Run one of the functions the page offers the app (window.__rings in js/main.js). */
    static void tell(WebView web, String call) {
        if (web != null) web.evaluateJavascript("window.__rings&&__rings." + call, null);
    }
}
