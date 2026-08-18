#!/bin/sh
set -e

# if coming from docker user needs to set HP_PLUGIN to true
# otherwise if running manually (local install) assume if user tries to run script it should try to install plugin (duh)
HP_PLUGIN="${HP_PLUGIN:=true}"
if [ "$PLUGIN" != "false" ]; then

  # if variable is true then try to determine plugin version automatically
  if [ "$HP_PLUGIN" = "true" ]; then

      echo "Trying to determine HPLIP plugin version from 'hp-plugin' command..."
      set +e
      # determine installed HPLIP version
      RE="HP Linux Imaging and Printing System \(ver\. (.+?)\)"
      #cmd_output=$(hp-plugin --help 2>&1)$?
      cmd_output=$(hp-plugin --help 2>&1)
      cmd_exit=$?
      set -e
      if [ "$cmd_exit" != "0" ];
      then
        echo "'hp-plugin' command does not seem to be installed! Cannot determine plugin version automatically so will skip plugin installation."
        echo "'hp-plugin' command output: $cmd_output"
        exit 1
      fi
      #https://stackoverflow.com/a/2778096
      RAW_VERSION="$(echo "$cmd_output" | sed -rn "s/$RE/\1/p")"
      # Remove ansi coloring so its just a raw string
      #https://stackoverflow.com/a/51141872
      HPLIP_VERSION=$(echo "$RAW_VERSION" | sed 's/\x1B\[[0-9;]\{1,\}[A-Za-z]//g')
      printf 'HPLIP Version: %s\n' "$HPLIP_VERSION"

    # check if plugin is already installed
    # files installed to these locations https://wiki.gentoo.org/wiki/HPLIP#Binary_plugins
    if [ -d /usr/share/hplip/data/firmware ]; then
      printf 'A plugin is already installed. To force (re)install specify version in ENV like HP_PLUGIN=%s\n' "$HPLIP_VERSION"
    else
      INSTALL_PLUGIN_VERSION=$HPLIP_VERSION
    fi
  else
    INSTALL_PLUGIN_VERSION=$HPLIP_VERSION
  fi
else
  echo "To install HPLIP plugin the env HP_PLUGIN must be either 'true' or specify a version"
  exit 1
fi

if [ ! -z "$INSTALL_PLUGIN_VERSION" ]; then
  printf 'Attempting to install HPLIP plugin version %s\n' "$INSTALL_PLUGIN_VERSION"
  PLUGIN_FILE="/tmp/hplip-$INSTALL_PLUGIN_VERSION-plugin.run"

  if [ ! -f "$PLUGIN_FILE" ]; then
      echo 'Plugin does not already existing, downloading...'
      wget --backups 0 -q -P /tmp "https://developers.hp.com/sites/default/files/hplip-$INSTALL_PLUGIN_VERSION-plugin.run" || true
  fi
  echo "Making plugin runnable..."
  chmod +x "$PLUGIN_FILE"
  echo "Starting plugin install..."
  # has to run as root in order to prevent erroneous invisible password prompt after license accept
  su root -c "yes y | $PLUGIN_FILE --noprogress --accept --nox11 -- -i"
  echo "HPLIP plugin installed!"
fi
