package com.alex.farm3d;

import android.os.Bundle;
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
        // Allow Web Audio / media after first gesture; reduce Android autoplay blocks
        try {
            WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
            if (webView != null) {
                WebSettings s = webView.getSettings();
                s.setMediaPlaybackRequiresUserGesture(false);
                s.setDomStorageEnabled(true);
            }
        } catch (Throwable ignored) {}
    }
}
