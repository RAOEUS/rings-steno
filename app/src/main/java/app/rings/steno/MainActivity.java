package app.rings.steno;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.Window;
import android.view.WindowInsets;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.FrameLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/** The app screen: the whole page, for practice, lessons, dictionaries, settings and the guide. */
public class MainActivity extends Activity {
    /** Intent extra: a panel of the page to open ("settings" or "library"). */
    static final String PANEL = "panel";

    private static final int PICK_FILES = 1;
    private static final int MAX_FILE_BYTES = 64 << 20;
    private WebView web;
    private ValueCallback<Uri[]> picking;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        web = Page.open(this, null);

        // The page sits in a frame that takes the status bar, gesture bar and any keyboard as padding, coloured like
        // the page so the bars blend in.
        FrameLayout frame = new FrameLayout(this);
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        frame.setBackgroundColor(night ? 0xFF15172B : 0xFFEEF2E3);
        frame.addView(web);
        setContentView(frame);
        frame.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsets.CONSUMED;
        });

        web.setWebChromeClient(new WebChromeClient() {
            // "Add files" on the page: the phone's own file picker
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (picking != null) picking.onReceiveValue(null);
                picking = callback;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(pick, PICK_FILES);
                } catch (Exception e) {
                    picking = null;
                    callback.onReceiveValue(null);
                }
                return true;
            }
        });
        handle(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handle(intent);
    }

    @Override protected void onResume() {
        super.onResume();
        Page.tell(web, "resume()");      // the keyboard may have just been switched on in the phone's settings
    }

    /** The keyboard can send you here for a panel. Another app can send dictionary files. */
    private void handle(Intent intent) {
        if (intent == null) return;
        String panel = intent.getStringExtra(PANEL);
        if ("settings".equals(panel) || "library".equals(panel)) web.loadUrl(Page.URL + "#" + panel);      // the page opens it once it is up

        List<Uri> files = new ArrayList<>();
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action) && intent.getData() != null) files.add(intent.getData());
        if (Intent.ACTION_SEND.equals(action) && intent.getParcelableExtra(Intent.EXTRA_STREAM) != null) files.add(intent.getParcelableExtra(Intent.EXTRA_STREAM));
        if (Intent.ACTION_SEND_MULTIPLE.equals(action) && intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM) != null) files.addAll(intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM));
        if (files.isEmpty()) return;
        setIntent(new Intent(this, MainActivity.class));      // handled: do not ask again if the screen is rebuilt
        confirm(files);
    }

    /**
     * Any app can send files here, and a Python dictionary or a plugin is code that would run inside the keyboard. So
     * nothing that arrives from outside is added until the person holding the phone has seen what it is and said yes.
     */
    private void confirm(List<Uri> files) {
        StringBuilder names = new StringBuilder();
        boolean code = false;
        for (Uri uri : files) {
            String name = nameOf(uri);
            names.append("\n\u2022 ").append(name);
            String lower = name.toLowerCase();
            code |= lower.endsWith(".py") || lower.endsWith(".whl") || lower.endsWith(".zip");
        }
        String message = "Another app sent this to Rings:" + names
            + (code ? "\n\nPython dictionaries and plugins run as code inside Rings, which sees everything you write. Add them only if you trust where they came from." : "");
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Add to your dictionaries?")
            .setMessage(message)
            .setPositiveButton("Add", (d, which) -> new Thread(() -> addFiles(files), "add-files").start())
            .setNegativeButton("Cancel", null)
            .show();
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setFilterTouchesWhenObscured(true);      // no tapping it through another app's overlay
    }

    /** Files shared to Rings or opened with it go to Plover the same way the page's Add files button sends them. */
    private void addFiles(List<Uri> files) {
        JSONArray list = new JSONArray();
        String problem = null;
        for (Uri uri : files) {
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[65536];
                for (int n; (n = in.read(buffer)) > 0; ) {
                    bytes.write(buffer, 0, n);
                    if (bytes.size() > MAX_FILE_BYTES) throw new java.io.IOException("too large");
                }
                list.put(new JSONArray().put(nameOf(uri)).put(Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)));
            } catch (Exception e) {
                problem = "Could not read " + nameOf(uri) + ".";
            }
        }
        Bridge.addedFiles = list.length() == 0
            ? "{\"error\":" + JSONObject.quote(String.valueOf(problem)) + "}"
            : Plover.call(this, "add_files", new JSONArray().put(list).toString());
        runOnUiThread(() -> Page.tell(web, "added()"));
    }

    private String nameOf(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst() && c.getString(0) != null) return c.getString(0);
        } catch (Exception e) {
            // fall through to the address
        }
        String last = uri.getLastPathSegment();
        return last == null ? "dictionary" : last.substring(last.lastIndexOf('/') + 1);
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != PICK_FILES || picking == null) return;
        Uri[] uris = null;
        if (result == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                uris = new Uri[data.getClipData().getItemCount()];
                for (int i = 0; i < uris.length; i++) uris[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                uris = new Uri[] {data.getData()};
            }
        }
        picking.onReceiveValue(uris);
        picking = null;
    }

    @Override public void onBackPressed() {
        // Back closes an open panel first
        web.evaluateJavascript("(function(){var p=document.querySelector('.scrim.show');if(p){p.classList.remove('show');return true}return false})()",
            closed -> { if (!"true".equals(closed)) finish(); });
    }
}
