package com.alex.farm3d;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.Bridge;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private static final String TAG = "AppUpdate";
    private static final String PREFS = "farm_edge_update";
    private static final String KEY_WEB_PATH = "live_web_path";
    private static final String KEY_WEB_VER = "live_web_version";


    @PluginMethod
    public void fetchManifest(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url required");
            return;
        }
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL u = new URL(url);
                conn = (HttpURLConnection) u.openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(20000);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("Accept", "application/json");
                conn.connect();
                int code = conn.getResponseCode();
                InputStream stream = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
                java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                if (stream != null) {
                    while ((n = stream.read(buf)) != -1) bos.write(buf, 0, n);
                    stream.close();
                }
                String body = bos.toString("UTF-8");
                if (code >= 400) {
                    final String err = "HTTP " + code + ": " + body;
                    getBridge().getActivity().runOnUiThread(() -> call.reject(err));
                    return;
                }
                final String json = body;
                getBridge().getActivity().runOnUiThread(() -> {
                    try {
                        JSObject ret = new JSObject();
                        ret.put("body", json);
                        // also parse into object if possible
                        ret.put("manifest", new JSObject(json));
                        call.resolve(ret);
                    } catch (Exception e) {
                        JSObject ret = new JSObject();
                        ret.put("body", json);
                        call.resolve(ret);
                    }
                });
            } catch (Exception e) {
                final String msg = e.getMessage();
                getBridge().getActivity().runOnUiThread(() -> call.reject(msg));
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            String versionName = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0).versionName;
            int versionCode;
            if (Build.VERSION.SDK_INT >= 28) {
                versionCode = (int) getContext().getPackageManager()
                        .getPackageInfo(getContext().getPackageName(), 0).getLongVersionCode();
            } else {
                versionCode = getContext().getPackageManager()
                        .getPackageInfo(getContext().getPackageName(), 0).versionCode;
            }
            SharedPreferences sp = getContext().getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
            ret.put("versionName", versionName);
            ret.put("versionCode", versionCode);
            ret.put("webVersion", sp.getString(KEY_WEB_VER, versionName));
            ret.put("hasLiveWeb", sp.contains(KEY_WEB_PATH));
            ret.put("platform", "android");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("getInfo failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url required");
            return;
        }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject ret = new JSObject();
        boolean allowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            allowed = getContext().getPackageManager().canRequestPackageInstalls();
        }
        ret.put("allowed", allowed);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestInstallPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url required");
            return;
        }
        new Thread(() -> {
            File apk = null;
            try {
                apk = downloadToFile(url, "update.apk");
                installApk(apk);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("path", apk.getAbsolutePath());
                getBridge().getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (Exception e) {
                Log.e(TAG, "APK install failed", e);
                final String msg = e.getMessage();
                // fallback: open in browser
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(i);
                } catch (Exception ignored) {}
                getBridge().getActivity().runOnUiThread(() -> call.reject("install failed: " + msg));
            }
        }).start();
    }

    @PluginMethod
    public void downloadAndApplyWebBundle(PluginCall call) {
        String url = call.getString("url");
        String webVersion = call.getString("webVersion", "unknown");
        if (url == null || url.isEmpty()) {
            call.reject("url required");
            return;
        }
        new Thread(() -> {
            try {
                File zip = downloadToFile(url, "web-update.zip");
                File dest = new File(getContext().getFilesDir(), "live-www");
                deleteRecursive(dest);
                dest.mkdirs();
                unzip(zip, dest);
                // require index.html
                File index = new File(dest, "index.html");
                if (!index.exists()) {
                    // maybe zip has www/ prefix
                    File nested = new File(dest, "www/index.html");
                    if (nested.exists()) {
                        dest = nested.getParentFile();
                    } else {
                        throw new IllegalStateException("index.html not found in bundle");
                    }
                }
                SharedPreferences sp = getContext().getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
                sp.edit().putString(KEY_WEB_PATH, dest.getAbsolutePath()).putString(KEY_WEB_VER, webVersion).apply();

                final File liveDir = dest;
                getBridge().getActivity().runOnUiThread(() -> {
                    try {
                        Bridge bridge = getBridge();
                        bridge.setServerBasePath(liveDir.getAbsolutePath());
                        bridge.reload();
                        JSObject ret = new JSObject();
                        ret.put("ok", true);
                        ret.put("path", liveDir.getAbsolutePath());
                        ret.put("webVersion", webVersion);
                        call.resolve(ret);
                    } catch (Exception e) {
                        call.reject("apply failed: " + e.getMessage());
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "web bundle failed", e);
                getBridge().getActivity().runOnUiThread(() -> call.reject(e.getMessage()));
            }
        }).start();
    }

    /** Called from MainActivity onCreate to restore live path before WebView loads. */
    public static String getSavedLivePath(android.content.Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
        String path = sp.getString(KEY_WEB_PATH, null);
        if (path != null && new File(path, "index.html").exists()) return path;
        return null;
    }

    private void installApk(File apk) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!getContext().getPackageManager().canRequestPackageInstalls()) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                throw new IllegalStateException("Нужно разрешить установку из этого приложения");
            }
        }
        Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apk
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    private File downloadToFile(String urlStr, String name) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(120000);
        conn.setInstanceFollowRedirects(true);
        conn.connect();
        int code = conn.getResponseCode();
        if (code >= 400) throw new IllegalStateException("HTTP " + code);
        File out = new File(getContext().getCacheDir(), name);
        try (InputStream in = new BufferedInputStream(conn.getInputStream());
             FileOutputStream fos = new FileOutputStream(out)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) fos.write(buf, 0, n);
        }
        conn.disconnect();
        return out;
    }

    private static void unzip(File zip, File dest) throws Exception {
        try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(zip)))) {
            ZipEntry entry;
            byte[] buf = new byte[8192];
            while ((entry = zis.getNextEntry()) != null) {
                File f = new File(dest, entry.getName());
                String destPath = dest.getCanonicalPath();
                String filePath = f.getCanonicalPath();
                if (!filePath.startsWith(destPath + File.separator) && !filePath.equals(destPath)) {
                    throw new IllegalStateException("zip slip blocked");
                }
                if (entry.isDirectory()) {
                    f.mkdirs();
                } else {
                    File parent = f.getParentFile();
                    if (parent != null) parent.mkdirs();
                    try (FileOutputStream fos = new FileOutputStream(f)) {
                        int n;
                        while ((n = zis.read(buf)) != -1) fos.write(buf, 0, n);
                    }
                }
                zis.closeEntry();
            }
        }
    }

    private static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteRecursive(k);
        }
        f.delete();
    }
}
