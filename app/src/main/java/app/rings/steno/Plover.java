package app.rings.steno;

import android.content.Context;

import com.chaquo.python.PyObject;
import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;

import org.json.JSONObject;

/** The one Plover engine in the process. It lives in Python (src/main/python/rings); this is the door to it. */
final class Plover {
    private static PyObject api;

    private Plover() {}

    /** Start Python and Plover if they are not up yet. Slow the first time: call it early, off the main thread. */
    static synchronized PyObject start(Context context) {
        if (api == null) {
            if (!Python.isStarted()) Python.start(new AndroidPlatform(context.getApplicationContext()));
            api = Python.getInstance().getModule("rings");
        }
        return api;
    }

    /** Ask the engine for something. Arguments and answer are JSON; the answer is {"ok": ...} or {"error": ...}. */
    static String call(Context context, String method, String jsonArgs) {
        try {
            return start(context).callAttr("call", method, jsonArgs).toString();
        } catch (Throwable t) {
            return "{\"error\":" + JSONObject.quote(String.valueOf(t.getMessage())) + "}";
        }
    }
}
