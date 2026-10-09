#!/bin/sh
# scripts/agent-env.sh — quiet, deterministic, cache-friendly tool output.
# Source it: . scripts/agent-env.sh
export NO_COLOR=1
export CI=1
export PAGER=cat
export GIT_PAGER=cat
export TERM=dumb
