package app.rings.steno;

import android.content.Context;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.VibrationEffect.Composition;
import android.os.Vibrator;

/** What the sticks feel like: a small vocabulary of ticks, so a writer can tell what happened without looking. */
final class Haptics {
    private final Vibrator vibrator;

    Haptics(Context context) {
        vibrator = context.getSystemService(Vibrator.class);
    }

    /**
     * @param kind tick: a key came under the thumb. key: a key was added. far: a push went long. sent: the stroke has
     *             gone. miss: it had no entry.
     * @param strength 0 (off) to 100
     */
    void play(String kind, int strength) {
        if (vibrator == null || strength <= 0) return;
        float s = Math.max(0.05f, Math.min(1f, strength / 100f));
        VibrationEffect effect;
        if (vibrator.areAllPrimitivesSupported(Composition.PRIMITIVE_TICK, Composition.PRIMITIVE_CLICK)) {
            Composition c = VibrationEffect.startComposition();
            switch (kind) {
                case "tick": c.addPrimitive(Composition.PRIMITIVE_TICK, s); break;
                case "far": c.addPrimitive(Composition.PRIMITIVE_CLICK, s).addPrimitive(Composition.PRIMITIVE_CLICK, s, 60); break;
                case "sent": c.addPrimitive(Composition.PRIMITIVE_CLICK, Math.min(1f, s * 1.3f)); break;
                case "miss":
                    c.addPrimitive(Composition.PRIMITIVE_CLICK, s).addPrimitive(Composition.PRIMITIVE_CLICK, s, 70).addPrimitive(Composition.PRIMITIVE_CLICK, s, 70);
                    break;
                default: c.addPrimitive(Composition.PRIMITIVE_CLICK, s * 0.6f);
            }
            effect = c.compose();
        } else {      // an older motor: the nearest stock effects
            effect = VibrationEffect.createPredefined("far".equals(kind) || "miss".equals(kind) ? VibrationEffect.EFFECT_DOUBLE_CLICK
                : "tick".equals(kind) ? VibrationEffect.EFFECT_TICK : VibrationEffect.EFFECT_CLICK);
        }
        if (Build.VERSION.SDK_INT >= 33) vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH));
        else vibrator.vibrate(effect);
    }
}
