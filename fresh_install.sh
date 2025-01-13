#!/bin/bash

# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

# Source .bashrc to make nvm available in the script
source ~/.bashrc

# Install Node.js
nvm install v18.17.0

# Install yt-dlp
sudo apt-get update && sudo apt-get install -y yt-dlp

sudo apt-get install -y npm

sudo npm i -g forever

mkdir logs