#!/bin/bash

# scanservjs installer script for Debian and Ubuntu
# Usage:
#   curl -s https://raw.githubusercontent.com/sbs20/scanservjs/master/packages/server/installer.sh | sudo bash -s --

tmp="/tmp/scanservjs.bkp"
location="/var/www/scanservjs"

assert_root() {
  if [ "$(id -u)" -ne "0" ]; then
      echo "Error: This script must be executed with root privileges. Try sudo."
      exit 1
  fi
}

install() {
  # minimum dependencies
  apt-get update
  apt-get install -yq \
    curl \
    nodejs \
    npm \
    imagemagick \
    sane-utils \
    tesseract-ocr

  npm install npm@7.11.2 -g

  if [ -d "$location" ]; then
    # keep config and data
    mkdir -p $tmp

    echo "Backing up existing files"
    cp -a $location/config $tmp
    cp -a $location/data $tmp

    # stop the service
    if [ "$(systemctl is-active scanservjs 2>&1 | tr -s \\n)" = "active" ]; then
        systemctl stop scanservjs
    fi

    # wipe previous install
    rm -rf $location
  fi

  if [ -z "$(grep scanservjs /etc/passwd 2>&1 | tr -s \\n)" ]; then
    # Create a user for this service and set primary group to "users"
    useradd -m -g users scanservjs

    # Add the new user to the scanner group too (created by SANE)
    usermod -aG scanner scanservjs

    # Add the new user to the lp group too (for Ubuntu)
    usermod -aG lp scanservjs
  fi

  mkdir -p $location

  if [ "1" = "$auto" ]; then
    url=$(curl -s https://api.github.com/repos/sbs20/scanservjs/releases/latest | grep browser_download_url | cut -d '"' -f 4)
    curl -L $url | tar -zxf - -C $location/

  else
    srcdir="$(cd "$(dirname "$0")" && pwd)"
    if [ ! -e $srcdir/scanservjs.service ]; then
      echo "Cannot find other package files. Did you mean to run --auto-install?"
      exit 1;
    fi
    cp -rf $srcdir/* $location
  fi

  # Restore files
  if [ -d "$tmp" ]; then
    echo "Restoring files"
    cp -a -v $tmp/config $location/
    cp -a -v $tmp/data $location/
  fi

  # Set the file owners
  chown -R scanservjs:users $location/config
  chown -R scanservjs:users $location/data

  # ... and ensure the server is executable
  chmod +x $location/server/server.js

  # Enable PDF
  sed -i 's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ /etc/ImageMagick-6/policy.xml

  # Install all the node dependencies
  cd $location && npm install --only=production

  # Now copy the service definition
  cp $location/scanservjs.service /etc/systemd/system

  # Reload the deamon info
  systemctl daemon-reload

  if [ -z "$(netstat -tulpn | grep '\:8080\s')" ]; then
    # Enable and start the new service
    systemctl enable scanservjs
    systemctl start scanservjs

    cat << EOF

scanservjs installed and running
  http://127.0.0.1:8080
EOF

  else
    cat << EOF

scanservjs installed but it looks as if something might be running on port 8080.

$ netstat -tulpn | grep :8080 --->
  $(netstat -tulpn | grep ":8080\s")

Either
* update the port in $location/config/config.local.js or 
* Stop the other program

After that you can just enable and start:
  systemctl enable scanservjs
  systemctl start scanservjs
EOF
  fi

  cat << EOF

If you encounter problems when running, try
  sudo journalctl -e -u scanservjs

EOF

}

uninstall() {
  # Stop and dsiable service
  if [ "$(systemctl is-active scanservjs 2>&1 | tr -s \\n)" = "active" ]; then
    systemctl stop scanservjs
  fi

  if [ "$(systemctl is-enabled scanservjs 2>&1 | tr -s \\n)" = "active" ]; then
    systemctl disable scanservjs
  fi

  # Remove service definition and reload
  rm -f /etc/systemd/system/scanservjs.service
  systemctl daemon-reload

  # Remove user
  if [ ! -z "$(grep scanservjs /etc/passwd 2>&1 | tr -s \\n)" ]; then
    userdel -r scanservjs
  fi

  echo "scanservjs removed"
}

hard_uninstall() {
  # Remove all files
  rm -rf $location

  # remove dependencies
  apt-get remove -yq \
    curl \
    nodejs \
    npm \
    imagemagick \
    sane-utils \
    tesseract-ocr
}

print_help() {
  cat << EOF

scanservjs: https://github.com/sbs20/scanservjs

# Overview
==========
  This script will install or remove scanservjs with the bare minimum for it to
  work. If you are installing then it will add sane-utils but not sane, as you
  may have your sane backend running on another server. It will not install
  sane-airscan either.

  If you want to install sane and airscan then run the following:

    apt-get update
    apt-get install -yq curl gpg tee
    echo 'deb http://download.opensuse.org/repositories/home:/pzz/Debian_10/ /' | tee /etc/apt/sources.list.d/home:pzz.list
    curl -fsSL https://download.opensuse.org/repositories/home:pzz/Debian_10/Release.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/home:pzz.gpg > /dev/null
    apt-get install -yq \
        sane \
        sane-airscan

# Auto-install
==============
  Runs install but downloads the latest stable release from GitHub

# Install
=========
  Install runs through the following steps

    * run apt-get update
    * install SANE, node and imagemagick dependencies
    * create the web application in /var/www/scanservjs
    * create a user and systemd service which is enabled and started

# Uninstall
===========
  * Remove the user and systemd service

# Arguments
===========
  usage:
    -a | --auto-install : install scanservjs from GitHub
    -i | --install      : install scanservjs from local package
    -u | --uninstall    : uninstall scanservjs (leaves web and data files)
    --force-uninstall   : uninstall scanservjs (removes all dependencies - dragons here)

# Running via curl
==================
  If you just ran this from curl and want to install, then just append '-a' to
  your previous command so it looks like:

    curl -s https://raw.githubusercontent.com/sbs20/scanservjs/master/packages/server/installer.sh | sudo bash -s -- -a

EOF
}

# main
assert_root

case "$1" in
  -a|--auto-install)
    auto=1
    install
    ;;
  -i|--install)
    auto=0
    install
    ;;
  -u|--uninstall)
    uninstall
    ;;
  --force-uninstall)
    uninstall
    hard_uninstall
    ;;
  -h|--help)
    print_help
    ;;
  *)
    print_help
    ;;
esac
