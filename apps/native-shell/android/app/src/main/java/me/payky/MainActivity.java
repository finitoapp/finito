package me.payky;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SwitchioPlugin.class);
        registerPlugin(NfcPlugin.class);
        registerPlugin(AccountSharePlugin.class);

        super.onCreate(savedInstanceState);
        enableEdgeToEdge();
        hideSystemBars();

        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);

        // The bars come back for good whenever the window loses focus - after
        // returning from another activity (the SwitchioPay terminal, say), or
        // once the soft keyboard has been up. Re-hiding on focus is what keeps
        // the terminal fullscreen for a whole shift.
        if (hasFocus) {
            hideSystemBars();
        }
    }

    /**
     * Runs the app as a true fullscreen kiosk: the status and navigation bars
     * are hidden and only reappear transiently on a swipe from the edge.
     *
     * Edge-to-edge alone is not enough. Android WebView maps only the display
     * cutout onto CSS `env(safe-area-inset-*)`, never the system bars, so the
     * web layer cannot pad around a visible navigation bar the way it does on
     * iOS - the bar simply covers the bottom of the page.
     */
    private void hideSystemBars() {
        Window window = getWindow();
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());

        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    private void enableEdgeToEdge() {
        Window window = getWindow();

        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams layoutParams = window.getAttributes();
            layoutParams.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(layoutParams);
        }

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }
}
