#!/bin/bash

# scanservjs installation script for Debian and Ubuntu

# Usage:

#   curl -s https://github.com/sbs20/scanservjs/blob/master/install.sh | sudo bash -s -i

# This script will install the bare minimum for scanservjs to work. It will
# install sane-utils but not sane - you may have your sane backend running on
# another server. It will not install sane-airscan either.

# To do this then run

# ```
# apt-get update
# apt-get install -yq curl gpg tee
# echo 'deb http://download.opensuse.org/repositories/home:/pzz/Debian_10/ /' | tee /etc/apt/sources.list.d/home:pzz.list
# curl -fsSL https://download.opensuse.org/repositories/home:pzz/Debian_10/Release.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/home:pzz.gpg > /dev/null
# apt-get install -yq \
#     sane \
#     sane-airscan
# ```

tmp="/tmp/scanservjs"
location="/var/www/scanservjs"

assert_root() {
  if [ "$(id -u)" -ne "0" ]; then
      echo "Error: This script must be executed with root privileges. Try sudo."
      exit 1
  fi
}

install() {

  cat << EOF
This script will install scanservjs from https://github.com/sbs20/scanservjs
with the bare minimum for it to work. It will install sane-utils but not sane,
as you may have your sane backend running on another server. It will not install
sane-airscan either. For more information see the source of this script on
github.

It will:

* run apt-get update
* install SANE, node and imagemagick dependencies
* create the web application in /var/www/scanservjs
* create a user and systemd service which is enabled and started

Do you want to continue? [y/N]: 
EOF
  read do_install

  if [ "y" != "$do_install" ]; then
    echo "Abort."
    exit 0
  fi

  # minimum dependencies
  apt-get update
  apt-get install -yq \
    curl \
    nodejs \
    npm \
    imagemagick \
    sane-utils \
    tesseract-ocr

  npm install npm@latest -g

  if [ -d "$location" ]; then
    # keep config and data
    mkdir -p $tmp
    cp -a -v $location/config $tmp
    cp -a -v $location/data $tmp

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
  url=$(curl -s https://api.github.com/repos/sbs20/scanservjs/releases/latest | grep browser_download_url | cut -d '"' -f 4)
  curl -L $url | tar -zxf - -C $location/

  # Copy the files back
  if [ -d "$tmp" ]; then
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

  # Enable and start the new service
  systemctl enable scanservjs
  systemctl start scanservjs

  echo "scanservjs installed and running"
  echo "http://127.0.0.1:8080"
  echo
  echo "If you have problems, try 'sudo journalctl -e -u scanservjs'"
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

# main
assert_root

case "$1" in
  -i|--install)
    install
    ;;
  -u|--uninstall)
    uninstall
    ;;
  --force-uninstall)
    uninstall
    hard_uninstall
    ;;
  *)
    cat << EOF
Unknown argument
usage:
  -i | --install    : install scanservjs
  -u | --uninstall  : uninstall scanservjs (leaves web and data files)
  --force-uninstall : uninstall scanservjs (removes all dependencies - dragons here)
EOF
    ;;
esac
