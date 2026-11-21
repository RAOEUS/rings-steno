package app.rings.steno;

/** What only the keyboard can do for the page. The app screen has no such host. */
interface KeyboardHost {
    /** Type what one stroke produced into the app being written in. result is the engine's answer to "stroke". */
    void type(String strokeResult);

    /** The page's tape and pad are this tall, in CSS pixels: that much of the screen is the keyboard. */
    void setKeyboardHeight(int cssPx);

    /** The page is up, or the writer moved to a new place: tell the page what is before the cursor. */
    void fieldChanged();

    /** Height in CSS pixels of the phone's gesture bar where it overlaps the keyboard. */
    int navInsetCss();
}
