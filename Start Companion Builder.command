#!/bin/zsh
builder_dir="${0:A:h}"
cd "$builder_dir" || exit 1

if command -v node >/dev/null 2>&1; then
  exec node src/server.js
fi

codex_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [[ -x "$codex_node" ]]; then
  exec "$codex_node" src/server.js
fi

echo "Node.js 20 or newer is required to start Companion Command Builder."
echo "Download it from: https://nodejs.org/"
echo ""
read -k 1 "?Press any key to close."
exit 1
