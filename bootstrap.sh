#!/bin/bash

# scanservjs installer script for Debian and Ubuntu
# Usage:
#   curl -s https://raw.githubusercontent.com/sbs20/scanservjs/master/bootstrap.sh | sudo bash -s --
#
# This script is not packaged with the distribution. It is designed to be run
# online or in a development environmet only. The actual install script is
# contained in the root of the package.

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
  echo "Downloading to $TEMPD/..."
  curl -L $url | tar -zxf - -C "$TEMPD/"
  ls $TEMPD
  $TEMPD/installer.sh -i
}

print_help() {
  cat << EOF

scanservjs: https://github.com/sbs20/scanservjs

# Overview
==========
  This script will download scanservjs and execute the install script for it.
  
  The install script varies per version but typically it installs the bare
  minimum for it to work. It will add sane-utils but not sane, as you may have
  your sane backend running on another server. For further information look at
  the install script of the version you're intending to install.

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
