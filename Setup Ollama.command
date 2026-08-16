#!/bin/zsh

echo "Companion Command Builder · Local AI setup"
echo ""

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed."
  echo "Download the macOS application from: https://ollama.com/download"
  echo "Then run this setup again."
  echo ""
  read -k 1 "?Press any key to close."
  exit 1
fi

if ! curl --silent --fail http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Starting Ollama…"
  nohup ollama serve > /tmp/companion-builder-ollama.log 2>&1 &
  sleep 2
fi

echo "Installing the local qwen3:4b model (about 2.5 GB)…"
if ollama pull qwen3:4b; then
  echo ""
  echo "Local AI is ready. No API key is required."
  echo "Restart Companion Command Builder to use the AI fallback."
else
  echo ""
  echo "The model could not be installed. Check the internet connection and try again."
fi

echo ""
read -k 1 "?Press any key to close."
