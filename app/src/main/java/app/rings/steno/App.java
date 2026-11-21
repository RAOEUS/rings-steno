package app.rings.steno;

import android.app.Application;

/** Starts Plover as soon as the process exists, so neither the keyboard nor the app screen waits for it later. */
public class App extends Application {
    @Override public void onCreate() {
        super.onCreate();
        new Thread(() -> Plover.start(this), "plover-boot").start();
    }
}
