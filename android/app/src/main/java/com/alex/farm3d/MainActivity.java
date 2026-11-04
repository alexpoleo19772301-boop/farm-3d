package com.alex.farm3d;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        String live = AppUpdatePlugin.getSavedLivePath(this);
        if (live != null && this.bridge != null) {
            this.bridge.setServerBasePath(live);
        }
        try {
            WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
            if (webView != null) {
                WebSettings s = webView.getSettings();
                s.setMediaPlaybackRequiresUserGesture(false);
                s.setDomStorageEnabled(true);
                // Kill Android WebView / View system click beeps (often heard instead of game SFX)
                webView.setSoundEffectsEnabled(false);
                View root = webView.getRootView();
                if (root != null) root.setSoundEffectsEnabled(false);
                disableSoundEffectsDeep(webView);
            }
        } catch (Throwable ignored) {}
    }

    private static void disableSoundEffectsDeep(View v) {
        if (v == null) return;
        try { v.setSoundEffectsEnabled(false); } catch (Throwable ignored) {}
        if (v instanceof android.view.ViewGroup) {
            android.view.ViewGroup g = (android.view.ViewGroup) v;
            for (int i = 0; i < g.getChildCount(); i++) {
                disableSoundEffectsDeep(g.getChildAt(i));
            }
        }
    }
}
