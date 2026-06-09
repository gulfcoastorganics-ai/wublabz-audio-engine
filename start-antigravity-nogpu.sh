#!/usr/bin/env bash
cd "$HOME/antigravity-ide/Antigravity IDE" || exit 1
ELECTRON_DISABLE_GPU=1 ./antigravity-ide \
  --disable-gpu \
  --disable-gpu-compositing \
  --disable-software-rasterizer=false \
  --no-sandbox \
  /home/gulfcoastorganics
