#!/bin/sh
set -e

HP_AIO="${HP_AIO:=false}"
HP_PLUGIN="${HP_PLUGIN:=false}"

if [ "$HP_AIO" = "true" ] || [ "$HP_PLUGIN" != "false" ];
then
  if [ $(dpkg-query -W -f='${Status}' libsane-hpaio 2>/dev/null | grep -c "ok installed") -eq 0 ];
  then

    if [ "$HP_AIO" = "true" ];
    then
      echo "HP_AIO is true and libsane-hpaio is not installed. Installing now."
    else
      echo "HP_PLUGIN is not false and libsane-hpaio is not installed. Installing now."
    fi

    apt-get -qq update > /dev/null \
      && apt-get install -yq libsane-hpaio > /dev/null \
      && apt-get -q clean > /dev/null \
      && rm -rf /var/lib/apt/lists/*

    echo "libsane-hpaio installed!"
  else
    echo "libsane-hpaio is already installed"
  fi
fi

# only install plugin if user specifies (assuming coming from docker)
if [ "$HP_PLUGIN" != "false" ];
then
  /scripts/hplip.sh || true
fi
