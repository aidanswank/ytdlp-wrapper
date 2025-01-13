#!/bin/bash
forever start --append -l "$(pwd)/logs/$(date +%Y-%m-%d)_forever.log" -o "$(pwd)/logs/$(date +%Y-%m-%d)_out.log" -e "$(pwd)/logs/$(date +%Y-%m-%d)_err.log" server.js
