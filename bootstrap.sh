#!/bin/bash

# scanservjs installer script for Debian based distros
# Usage:
#   curl -s https://raw.githubusercontent.com/sbs20/scanservjs/master/bootstrap.sh | sudo bash -s --
#
# This script is not packaged with the distribution. It is designed to be run
# online or in a development environmet only.

# Be sure we're root
if [ "$(id -u)" -ne "0" ]; then
  echo "Error: This script must be executed with root privileges. Try sudo."
  exit 1
fi

# Create a temporary directory and store its name in a variable.
TEMPD=$(mktemp -d)

# Exit if the temp directory wasn't created successfully.
if [ ! -e "$TEMPD" ]; then
  >&2 echo "Failed to create temp directory"
  exit 1
fi

# APT installs as the _apt user - it needs access
chmod +rx $TEMPD

# Make sure the temp directory gets removed on script exit.
trap "exit 1"           HUP INT PIPE QUIT TERM
trap 'rm -rf "$TEMPD"'  EXIT

install() {
  if [ "latest" = "$version" ]; then
    release_url="https://api.github.com/repos/sbs20/scanservjs/releases/latest"

  else
    release_url="https://api.github.com/repos/sbs20/scanservjs/releases/tags/$version"
  fi

  url=$(curl -s $release_url | grep browser_download_url | cut -d '"' -f 4)

  if [ "" = "$url" ]; then
    cat << EOF
# Error
=======
  Unable to find release "$version". Please find the release you want here:

    https://github.com/sbs20/scanservjs/releases

  Or choose "latest".

EOF
    exit 1
  fi

  echo "Found asset: $url"
  cd $TEMPD
  echo "Downloading to $TEMPD/..."
  curl -O -L $url
  local filename=$(ls)

  # Old versions are packaged as tarballs which contain `installer.sh`
  if echo $filename | grep -q '.tar.gz$'; then
    echo "Found .tar.gz ($filename)"
    mkdir inflated
    tar -zxf $filename -C inflated
    inflated/installer.sh -i
  fi

  # Newer releases are packaged as deb packages which can be installed with apt
  if echo $filename | grep -q '.deb$'; then
    echo "Found .deb ($filename)"
    apt-get install -y "./$filename"
  fi
}

print_help() {
  cat << EOF

scanservjs: https://github.com/sbs20/scanservjs

# Overview
==========
  This script will download scanservjs and install it.

# Arguments
===========
  usage:
    -v | --version      : The tag version you want to install e.g. v2.27.0. Or
                          use 'latest'
    -h | --help         : This message

# Running via curl
==================
  If you just ran this from curl and want to install, then just append

    '-v latest'

  to your previous command so it looks like:

    curl -s https://raw.githubusercontent.com/sbs20/scanservjs/master/bootstrap.sh | sudo bash -s -- -v latest

EOF
}

case "$1" in
  -v|--version)
    version="$2"
    if [ "" = "$version" ]; then
      print_help
    else
      install
    fi
    ;;
  -h|--help)
    print_help
    ;;
  *)
    print_help
    ;;
esac
