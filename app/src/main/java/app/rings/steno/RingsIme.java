package app.rings.steno;

import android.content.res.Configuration;
import android.inputmethodservice.InputMethodService;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.webkit.WebView;
import android.widget.FrameLayout;

/** The keyboard. Its face is the page, showing only the tape and the sticks. */
public class RingsIme extends InputMethodService implements KeyboardHost {
    private static final int HEADROOM_DP = 260;      // see-through space above the keyboard that a stick can open into

    private final Editor editor = new Editor(this);
    private FrameLayout root;
    private WebView web;
    private int keyboardPx;
    private int navPx;      // the gesture bar's strip at the bottom of the keyboard window

    @Override public void onCreate() {
        super.onCreate();
        onCreateInputView();      // load the page now, while nothing is waiting, so the keyboard is there the moment it is asked for
    }

    @Override public View onCreateInputView() {
        if (root == null) {
            root = new FrameLayout(this);
            keyboardPx = dp(250);
            web = Page.open(this, this);
            root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, keyboardPx + dp(HEADROOM_DP)));
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                int nav = insets.getInsets(WindowInsets.Type.navigationBars()).bottom;
                if (nav != navPx) {
                    navPx = nav;
                    Page.tell(web, "reload()");
                }
                return insets;
            });
        } else if (root.getParent() != null) {
            ((ViewGroup) root.getParent()).removeView(root);
        }
        return root;
    }

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    /**
     * Only the keyboard itself takes room and touches. The space above it stays see-through and passes touches on, so a
     * stick that opens near the top of the pad is drawn over the app instead of being cut off.
     */
    @Override public void onComputeInsets(Insets out) {
        super.onComputeInsets(out);
        if (root == null) return;
        int top = Math.max(0, root.getHeight() - keyboardPx);
        out.contentTopInsets = top;
        out.visibleTopInsets = top;
        out.touchableInsets = Insets.TOUCHABLE_INSETS_REGION;
        out.touchableRegion.set(0, top, root.getWidth(), root.getHeight());
    }

    @Override public boolean onEvaluateFullscreenMode() {
        return false;
    }

    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        Page.tell(web, "reload()");      // the theme may have changed
    }

    @Override public void onStartInputView(EditorInfo info, boolean restarting) {
        super.onStartInputView(info, restarting);
        Page.tell(web, "reload()");      // settings may have changed on the app screen
        if (!restarting) fieldChanged();
    }

    @Override public void onUpdateSelection(int oldStart, int oldEnd, int newStart, int newEnd, int candidatesStart, int candidatesEnd) {
        super.onUpdateSelection(oldStart, oldEnd, newStart, newEnd, candidatesStart, candidatesEnd);
        if (!editor.causedMove(newStart, newEnd)) fieldChanged();
    }

    // ---- KeyboardHost

    @Override public void type(String strokeResult) {
        editor.type(strokeResult);
    }

    @Override public void setKeyboardHeight(int cssPx) {
        int px = dp(cssPx);
        if (px == keyboardPx || web == null) return;
        keyboardPx = px;
        ViewGroup.LayoutParams params = web.getLayoutParams();
        params.height = keyboardPx + dp(HEADROOM_DP);
        web.setLayoutParams(params);
    }

    /**
     * A new place to write, or the writer moved the cursor: Plover's memory of earlier strokes no longer matches the
     * text, so it starts fresh. Whether the next word needs a space or a capital comes from what is before the cursor.
     */
    @Override public void fieldChanged() {
        InputConnection ic = getCurrentInputConnection();
        EditorInfo info = getCurrentInputEditorInfo();
        CharSequence before = ic == null ? null : ic.getTextBeforeCursor(1, 0);
        boolean attach = before == null || before.length() == 0 || Character.isWhitespace(before.charAt(0));
        boolean capital = ic != null && info != null && ic.getCursorCapsMode(info.inputType) != 0;
        editor.forgetCursor();
        Page.tell(web, "field(" + attach + "," + capital + ")");
    }

    @Override public int navInsetCss() {
        return Math.round(navPx / getResources().getDisplayMetrics().density);
    }
}
