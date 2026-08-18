#!/bin/zsh
set -euo pipefail

builder_root="${0:A:h:h}"
builder_dist="$builder_root/dist"
builder_work="$builder_dist/dmg-root"
builder_app="$builder_work/Companion Command Builder.app"
builder_contents="$builder_app/Contents"
builder_resources="$builder_contents/Resources"
builder_node="${BUILDER_NODE_BINARY:-$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node}"
builder_dmg="$builder_dist/Companion-Command-Builder-0.20.54-Beta-1-arm64.dmg"
builder_zip="$builder_dist/OPEN-THIS-Companion-Command-Builder-0.20.54-Beta-1.zip"
builder_iconset="$builder_dist/AppIcon.iconset"
builder_icon="$builder_dist/AppIcon.icns"

if [[ ! -x "$builder_node" ]]; then
  echo "Node runtime not found at: $builder_node"
  echo "Set BUILDER_NODE_BINARY to an arm64 Node 20+ executable."
  exit 1
fi

echo "Running mandatory CCB release audit..."
"$builder_node" --test "$builder_root"/test/*.test.js
"$builder_node" "$builder_root/work/stress-audit.js"
"$builder_node" "$builder_root/work/audit-live-connections.js"

rm -rf "$builder_work"
mkdir -p "$builder_contents/MacOS" "$builder_resources/runtime" "$builder_resources/app"

cp "$builder_root/packaging/macos/Info.plist" "$builder_contents/Info.plist"
cp "$builder_node" "$builder_resources/runtime/node"
cp -R "$builder_root/src" "$builder_resources/app/src"
cp -R "$builder_root/public" "$builder_resources/app/public"
cp "$builder_root/package.json" "$builder_resources/app/package.json"
cp "$builder_root/README.md" "$builder_resources/app/README.md"

rm -rf "$builder_iconset"
mkdir -p "$builder_iconset"
/usr/bin/sips -z 16 16 "$builder_root/packaging/macos/assets/app-icon-1024.png" --out "$builder_iconset/icon_16x16.png" >/dev/null
/usr/bin/sips -z 32 32 "$builder_root/packaging/macos/assets/app-icon-1024.png" --out "$builder_iconset/icon_16x16@2x.png" >/dev/null
/usr/bin/sips -z 32 32 "$builder_root/packaging/macos/assets/app-icon-1024.png" --out "$builder_iconset/icon_32x32.png" >/dev/null
/usr/bin/sips -z 64 64 "$builder_root/packaging/macos/assets/app-icon-1024.png" --out "$builder_iconset/icon_32x32@2x.png" >/dev/null
/usr/bin/sips -z 128 128 "$builder_root/packaging/macos/assets/app-icon-1024.png" --out "$builder_iconset/icon_128x128.png" >/dev/null
/usr/bin/sips -z 256 256 "$builder_root/packaging/macos/assets/app-icon-1024.png" --out "$builder_iconset/icon_128x128@2x.png" >/dev/null
/usr/bin/sips -z 256 256 "$builder_root/packaging/macos/assets/app-icon-1024.png" --out "$builder_iconset/icon_256x256.png" >/dev/null
/usr/bin/sips -z 512 512 "$builder_root/packaging/macos/assets/app-icon-1024.png" --out "$builder_iconset/icon_256x256@2x.png" >/dev/null
/usr/bin/sips -z 512 512 "$builder_root/packaging/macos/assets/app-icon-1024.png" --out "$builder_iconset/icon_512x512.png" >/dev/null
/usr/bin/sips -z 1024 1024 "$builder_root/packaging/macos/assets/app-icon-1024.png" --out "$builder_iconset/icon_512x512@2x.png" >/dev/null
"$builder_node" "$builder_root/packaging/create-icns.js" "$builder_iconset" "$builder_icon"
cp "$builder_icon" "$builder_resources/AppIcon.icns"

/usr/bin/xcrun swiftc -O -swift-version 5 \
  -module-cache-path "$builder_dist/swift-module-cache" \
  -framework AVFoundation -framework Speech -framework AppKit \
  "$builder_root/packaging/macos/Launcher.swift" \
  -o "$builder_contents/MacOS/Companion Command Builder"

cp "$builder_root/Setup Ollama.command" "$builder_work/Setup Ollama.command"
cp "$builder_root/packaging/macos/Install.txt" "$builder_work/Read Me.txt"
ln -s /Applications "$builder_work/Applications"

chmod +x "$builder_contents/MacOS/Companion Command Builder" "$builder_resources/runtime/node" "$builder_work/Setup Ollama.command"

# Finder metadata and quarantine/resource-fork attributes inherited from a
# previously installed runtime invalidate the new bundle's code signature.
/usr/bin/xattr -cr "$builder_work"
/usr/bin/codesign --force --sign - "$builder_resources/runtime/node"
/usr/bin/codesign --force --deep --sign - "$builder_app"
/usr/bin/codesign --verify --deep --strict "$builder_app"

rm -f "$builder_zip"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$builder_app" "$builder_zip"
/usr/bin/unzip -t "$builder_zip" >/dev/null

rm -f "$builder_dmg"
if ! /usr/bin/hdiutil create -volname "Companion Command Builder" -srcfolder "$builder_work" -ov -format UDZO "$builder_dmg"; then
  echo "Compressed DMG creation was unavailable; creating a device-free HFS image instead."
  rm -f "$builder_dmg"
  /usr/bin/hdiutil makehybrid -hfs -hfs-volume-name "Companion Command Builder" -o "$builder_dmg" "$builder_work"
fi

echo "$builder_dmg"
echo "$builder_zip"
