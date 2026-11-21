package app.rings.steno;

import android.inputmethodservice.InputMethodService;
import android.os.SystemClock;
import android.util.Log;
import android.view.KeyEvent;
import android.view.inputmethod.ExtractedText;
import android.view.inputmethod.ExtractedTextRequest;
import android.view.inputmethod.InputConnection;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

/** Types what Plover says to type into whatever app is being written in, and knows which cursor moves were its own. */
final class Editor {
    private final InputMethodService service;
    private long lastEdit;               // when we last typed
    private int expectedCursor = -1;     // where the cursor should be after it

    Editor(InputMethodService service) {
        this.service = service;
    }

    /** Type what one stroke produced. result is the engine's answer to "stroke". */
    void type(String result) {
        InputConnection ic = service.getCurrentInputConnection();
        if (ic == null) return;
        try {
            JSONArray ops = new JSONObject(result).getJSONObject("ok").getJSONArray("ops");
            if (ops.length() == 0) return;
            ic.beginBatchEdit();
            for (int i = 0; i < ops.length(); i++) {
                JSONArray op = ops.getJSONArray(i);
                switch (op.getString(0)) {
                    case "bs": ic.deleteSurroundingTextInCodePoints(op.getInt(1), 0); break;
                    case "str": ic.commitText(op.getString(1), 1); break;
                    case "combo": press(ic, op.getString(1)); break;
                    default: break;      // commands are the page's business
                }
            }
            ic.endBatchEdit();
            lastEdit = SystemClock.uptimeMillis();
            ExtractedText now = ic.getExtractedText(new ExtractedTextRequest(), 0);
            expectedCursor = now == null ? -1 : now.startOffset + now.selectionEnd;
        } catch (Exception e) {
            Log.e("Rings", "typing failed", e);
        }
    }

    /** Was this cursor move caused by our own typing? If not, the writer moved it and Plover's memory is stale. */
    boolean causedMove(int newStart, int newEnd) {
        return (newStart == newEnd && newStart == expectedCursor) || SystemClock.uptimeMillis() - lastEdit < 250;
    }

    void forgetCursor() {
        expectedCursor = -1;
    }

    /** A Plover key combination such as Control_L(Shift_L(Left)), pressed as hardware keys would be. */
    private void press(InputConnection ic, String combo) throws Exception {
        // Plover parses its own combination syntax: [[key name, pressed], ...]
        JSONArray events = new JSONObject(Plover.call(service, "key_events", new JSONArray().put(combo).toString())).getJSONArray("ok");
        int meta = 0;
        long down = SystemClock.uptimeMillis();
        for (int i = 0; i < events.length(); i++) {
            String name = events.getJSONArray(i).getString(0);
            boolean pressed = events.getJSONArray(i).getBoolean(1);
            Integer modifier = MODIFIERS.get(name);
            if (modifier != null) {
                meta = pressed ? meta | modifier : meta & ~modifier;
                continue;
            }
            int code = keyCode(name);
            if (code == KeyEvent.KEYCODE_UNKNOWN) continue;
            if (code == KeyEvent.KEYCODE_ENTER && meta == 0) {      // Return on its own: the box's own action (Send, Search, Go) or a new line
                if (pressed) {
                    ic.endBatchEdit();
                    service.sendKeyChar('\n');
                    ic.beginBatchEdit();
                }
                continue;
            }
            ic.sendKeyEvent(new KeyEvent(down, SystemClock.uptimeMillis(), pressed ? KeyEvent.ACTION_DOWN : KeyEvent.ACTION_UP, code, 0, meta));
        }
    }

    // Plover's key names to Android's key codes
    private static final Map<String, Integer> KEYS = new HashMap<>();
    private static final Map<String, Integer> MODIFIERS = new HashMap<>();

    static {
        Object[] keys = {
            "return", KeyEvent.KEYCODE_ENTER, "kp_enter", KeyEvent.KEYCODE_NUMPAD_ENTER, "tab", KeyEvent.KEYCODE_TAB, "escape", KeyEvent.KEYCODE_ESCAPE,
            "backspace", KeyEvent.KEYCODE_DEL, "delete", KeyEvent.KEYCODE_FORWARD_DEL, "space", KeyEvent.KEYCODE_SPACE, "insert", KeyEvent.KEYCODE_INSERT,
            "left", KeyEvent.KEYCODE_DPAD_LEFT, "right", KeyEvent.KEYCODE_DPAD_RIGHT, "up", KeyEvent.KEYCODE_DPAD_UP, "down", KeyEvent.KEYCODE_DPAD_DOWN,
            "home", KeyEvent.KEYCODE_MOVE_HOME, "end", KeyEvent.KEYCODE_MOVE_END, "page_up", KeyEvent.KEYCODE_PAGE_UP, "prior", KeyEvent.KEYCODE_PAGE_UP,
            "page_down", KeyEvent.KEYCODE_PAGE_DOWN, "next", KeyEvent.KEYCODE_PAGE_DOWN, "minus", KeyEvent.KEYCODE_MINUS, "equal", KeyEvent.KEYCODE_EQUALS,
            "bracketleft", KeyEvent.KEYCODE_LEFT_BRACKET, "bracketright", KeyEvent.KEYCODE_RIGHT_BRACKET, "backslash", KeyEvent.KEYCODE_BACKSLASH,
            "semicolon", KeyEvent.KEYCODE_SEMICOLON, "apostrophe", KeyEvent.KEYCODE_APOSTROPHE, "grave", KeyEvent.KEYCODE_GRAVE, "comma", KeyEvent.KEYCODE_COMMA,
            "period", KeyEvent.KEYCODE_PERIOD, "slash", KeyEvent.KEYCODE_SLASH, "menu", KeyEvent.KEYCODE_MENU, "caps_lock", KeyEvent.KEYCODE_CAPS_LOCK,
            "audioraisevolume", KeyEvent.KEYCODE_VOLUME_UP, "audiolowervolume", KeyEvent.KEYCODE_VOLUME_DOWN, "audiomute", KeyEvent.KEYCODE_VOLUME_MUTE,
            "audioplay", KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, "audionext", KeyEvent.KEYCODE_MEDIA_NEXT, "audioprev", KeyEvent.KEYCODE_MEDIA_PREVIOUS};
        for (int i = 0; i < keys.length; i += 2) KEYS.put((String) keys[i], (Integer) keys[i + 1]);
        Object[] modifiers = {
            "shift_l", KeyEvent.META_SHIFT_ON | KeyEvent.META_SHIFT_LEFT_ON, "shift_r", KeyEvent.META_SHIFT_ON | KeyEvent.META_SHIFT_RIGHT_ON,
            "control_l", KeyEvent.META_CTRL_ON | KeyEvent.META_CTRL_LEFT_ON, "control_r", KeyEvent.META_CTRL_ON | KeyEvent.META_CTRL_RIGHT_ON,
            "alt_l", KeyEvent.META_ALT_ON | KeyEvent.META_ALT_LEFT_ON, "alt_r", KeyEvent.META_ALT_ON | KeyEvent.META_ALT_RIGHT_ON,
            "super_l", KeyEvent.META_META_ON | KeyEvent.META_META_LEFT_ON, "super_r", KeyEvent.META_META_ON | KeyEvent.META_META_RIGHT_ON};
        for (int i = 0; i < modifiers.length; i += 2) MODIFIERS.put((String) modifiers[i], (Integer) modifiers[i + 1]);
    }

    private static int keyCode(String name) {
        Integer code = KEYS.get(name);
        if (code != null) return code;
        if (name.length() == 1) {
            char c = name.charAt(0);
            if (c >= 'a' && c <= 'z') return KeyEvent.KEYCODE_A + (c - 'a');
            if (c >= '0' && c <= '9') return KeyEvent.KEYCODE_0 + (c - '0');
        }
        if (name.matches("f\\d{1,2}")) return KeyEvent.KEYCODE_F1 + Integer.parseInt(name.substring(1)) - 1;
        return KeyEvent.KEYCODE_UNKNOWN;
    }
}
