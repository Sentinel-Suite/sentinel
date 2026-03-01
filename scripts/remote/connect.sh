#!/usr/bin/env bash
# Quick connect to Sentinel Suite dev VM with persistent tmux session.
# Usage: bash scripts/remote/connect.sh
ssh -t sentinel-dev "tmux new-session -A -s dev"
