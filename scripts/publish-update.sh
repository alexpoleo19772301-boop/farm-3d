#!/usr/bin/env bash
# Publish farm-3d: build, push docs (Pages), upload Release assets
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
VER="${1:?version e.g. 1.0.0}"
CHANGELOG="${2:-• Обновление $VER}"
OWNER="${GITHUB_OWNER:-alexpoleo19772301-boop}"
REPO="${GITHUB_REPO:-farm-3d}"
export JAVA_HOME="${JAVA_HOME:-/home/box/android/jdk-17.0.21+9}"
export ANDROID_HOME="${ANDROID_HOME:-/home/box/android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"
gh auth status >/dev/null
gh auth setup-git >/dev/null 2>&1 || true
IFS=. read -r MA MI PA <<<"$VER"
CODE=$((10#$MA * 10000 + 10#$MI * 1000 + 10#$PA))
APK_URL="https://github.com/${OWNER}/${REPO}/releases/download/v${VER}/ColorFlow-${VER}.apk"
WEB_URL="https://github.com/${OWNER}/${REPO}/releases/latest/download/www.zip"
MANIFEST_URL="https://github.com/${OWNER}/${REPO}/releases/latest/download/version.json"

mkdir -p dist docs www
python3 - "$VER" "$CODE" "$CHANGELOG" "$APK_URL" "$WEB_URL" "$MANIFEST_URL" <<'PY'
import json,sys,pathlib,re,zipfile
ver,code,log,apk,web,manifest=sys.argv[1],int(sys.argv[2]),sys.argv[3],sys.argv[4],sys.argv[5],sys.argv[6]
if '\\n' in log:
  try: log=log.encode().decode('unicode_escape')
  except Exception: pass
doc={"version":ver,"versionCode":code,"apkUrl":apk,"webVersion":ver,"webBundleUrl":web,"force":False,"changelog":log}
text=json.dumps(doc,ensure_ascii=False,indent=2)+"\n"
for p in ["version.json","www/version.json","docs/version.json","dist/version.json"]:
  pathlib.Path(p).write_text(text)
for rel in ["index.html","www/index.html","game.js","www/game.js"]:
  path=pathlib.Path(rel)
  if not path.exists(): continue
  t=path.read_text()
  t=re.sub(r"version:\s*'[^']*'","version: '%s'"%ver,t,count=1)
  t=re.sub(r"versionCode:\s*\d+","versionCode: %d"%code,t,count=1)
  t=re.sub(r"webVersion:\s*'[^']*'","webVersion: '%s'"%ver,t,count=1)
  t=re.sub(r">v[0-9.]+<",">v%s<"%ver,t,count=1)
  t=re.sub(r"const VERSION = '[^']*'","const VERSION = '%s'"%ver,t)
  t=re.sub(r"(\.(?:js)|\.min\.js)\?v=[0-9.]+",r"\1?v=%s"%ver,t)
  t=re.sub(r"DEFAULT_MANIFEST_URL=localStorage\.getItem\('farm3d_manifest_url'\)\|\|'[^']*'",
           "DEFAULT_MANIFEST_URL=localStorage.getItem('farm3d_manifest_url')||'%s'"%manifest, t)
  path.write_text(t)
r=pathlib.Path("www")
for o in [pathlib.Path("dist/www.zip")]:
  with zipfile.ZipFile(o,"w",zipfile.ZIP_DEFLATED) as z:
    for p in r.rglob("*"):
      if p.is_file() and p.name!="version-test.json":
        z.write(p, p.relative_to(r).as_posix())
print(text)
PY
cp -f www/index.html index.html 2>/dev/null || true
cp -f www/game.js game.js 2>/dev/null || true
sed -i "s/versionCode [0-9]*/versionCode $CODE/" android/app/build.gradle
sed -i "s/versionName \"[^\"]*\"/versionName \"$VER\"/" android/app/build.gradle
npm i --no-fund --no-audit
npx cap sync android
( cd android && ./gradlew assembleDebug --quiet )
cp -f android/app/build/outputs/apk/debug/app-debug.apk farm-3d-debug.apk
cp -f farm-3d-debug.apk "dist/farm-3d-$VER-debug.apk"
cp -f farm-3d-debug.apk "ColorFlow-${VER}.apk"
cp -f farm-3d-debug.apk "dist/ColorFlow-${VER}.apk"
cp -f farm-3d-debug.apk ColorFlow.apk
cp -f farm-3d-debug.apk dist/ColorFlow.apk
cp -f version.json dist/version.json
cp -f dist/www.zip dist/www.zip 2>/dev/null || true
# dist/www.zip no longer mirrored to Pages
# GitHub Pages
rm -rf docs/assets docs/vendor docs/js docs/index.html docs/game.js 2>/dev/null || true
cp -a www/. docs/
touch docs/.nojekyll
cp -f version.json docs/version.json
# cp -f dist/www.zip dist/www.zip  # skip: Pages fails on large zip churn

git add -A
git commit -m "Release v${VER}" || echo "nothing to commit"
git push origin HEAD:main

# GitHub Pages is served from gh-pages (not docs/ on main)
git fetch origin gh-pages
WT=$(mktemp -d)
git worktree add "$WT" origin/gh-pages
cp -a www/. "$WT"/
touch "$WT"/.nojekyll
cp -f version.json "$WT"/version.json
git -C "$WT" add -A
git -C "$WT" commit -m "Pages v${VER}" || echo "pages: nothing to commit"
git -C "$WT" push origin HEAD:gh-pages
git worktree remove "$WT" --force

TAG="v${VER}"
NOTES="v${VER}

${CHANGELOG}

Манифест: ${MANIFEST_URL}
APK: ${APK_URL}
www.zip: ${WEB_URL}
Pages: https://${OWNER}.github.io/${REPO}/
"
if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "ColorFlow-${VER}.apk" ColorFlow.apk farm-3d-debug.apk version.json dist/www.zip --clobber
  gh release edit "$TAG" --notes "$NOTES"
else
  gh release create "$TAG" "ColorFlow-${VER}.apk" ColorFlow.apk farm-3d-debug.apk version.json dist/www.zip --title "v${VER}" --notes "$NOTES"
fi
echo "Manifest: ${MANIFEST_URL}"
echo "Web ZIP:  ${WEB_URL}"
echo "APK:      ${APK_URL}"
echo "Pages:    https://${OWNER}.github.io/${REPO}/"
