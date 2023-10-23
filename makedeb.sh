#!/bin/sh

# Configure constants
BASE="./debian"
APP_NAME="scanservjs"
PATH_ETC="/etc/$APP_NAME"
PATH_SYSTEMD="/lib/systemd/system"
PATH_RUNTIME="/srv/$APP_NAME"
PATH_LIB="/usr/lib/$APP_NAME"
PATH_DOC="/usr/share/doc/$APP_NAME"
DIR_DEBIAN="$BASE/DEBIAN"
DIR_ETC="$BASE$PATH_ETC"
DIR_SYSTEMD="$BASE$PATH_SYSTEMD"
DIR_RUNTIME="$BASE$PATH_RUNTIME"
DIR_LIB="$BASE$PATH_LIB"
DIR_DOC="$BASE$PATH_DOC"
USER=scanservjs
GROUP=users
VERSION=$(cat package.json | grep '"version":' | cut -d '"' -f 4)

# Recreate structure
rm -rfv $BASE
mkdir -pv $DIR_DEBIAN
mkdir -pv $DIR_ETC
mkdir -pv $DIR_SYSTEMD
mkdir -pv $DIR_RUNTIME/output
mkdir -pv $DIR_RUNTIME/preview
mkdir -pv $DIR_RUNTIME/temp
mkdir -pv $DIR_RUNTIME/thumbnail
mkdir -pv $DIR_LIB
mkdir -pv $DIR_DOC

# Copy distribution
cp -rv dist/* $DIR_LIB

# Move and tidy up files
mv -v $DIR_LIB/data/preview/* $DIR_RUNTIME/preview/
mv -v $DIR_LIB/config/* $DIR_ETC/
rm -rfv $DIR_LIB/data \
  $DIR_LIB/config

# Create symlinks
ln -sv $PATH_RUNTIME $DIR_LIB/data
ln -sv $PATH_ETC $DIR_LIB/config

# systemd
cat > $DIR_SYSTEMD/scanservjs.service << EOF
[Unit]
Description=scanservjs
After=network.target

[Service]
ExecStart=$PATH_LIB/server/server.js
Restart=always
User=$USER
Group=$GROUP
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=NODE_ENV=production
WorkingDirectory=$PATH_LIB

[Install]
WantedBy=multi-user.target
EOF

# NPM is just recommended. The reason is that if it's required, then it fails in
# Debian Buster, where the only sensible way to install a modern nodejs is to
# use nodesource. Making it recommended but >= 7.5 keeps it off buster.

# DEBIAN/control
cat > $DIR_DEBIAN/control << EOF
Package: scanservjs
Version: $VERSION
Section: utils
Priority: optional
Architecture: all
Depends: adduser, nodejs (>= 12), imagemagick, sane-utils
Recommends: npm (>= 7.5), sane-airscan, ipp-usb, tesseract-ocr, tesseract-ocr-ara, tesseract-ocr-ces, tesseract-ocr-deu, tesseract-ocr-eng, tesseract-ocr-spa, tesseract-ocr-fra, tesseract-ocr-ita, tesseract-ocr-nld, tesseract-ocr-pol, tesseract-ocr-por, tesseract-ocr-rus, tesseract-ocr-tur, tesseract-ocr-chi-sim
Maintainer: Sam Strachan <info@sbs20.com>
Description: Web-based UI for SANE
  scanservjs allows you to share a scanner on a network without the need for
  drivers or complicated installation on end devices.
Installed-Size: $(du -s $BASE | cut -f 1)
Size: $(($(tar -Jcf - $BASE/* | wc -c) / 1024))
Homepage: https://github.com/sbs20/scanservjs
EOF

# DEBIAN/preint
cat > $DIR_DEBIAN/preinst << EOF
#!/bin/sh
if [ -d /var/www/scanservjs ] && grep -q '/var/www/scanservjs' /etc/systemd/system/scanservjs.service; then
  deb-systemd-invoke stop 'scanservjs.service' >/dev/null || true
  rm -f /etc/systemd/system/scanservjs.service
fi
EOF

# DEBIAN/postinst
cat > $DIR_DEBIAN/postinst << EOF
#!/bin/sh

# Core installation
if [ "\$1" = "configure" ] ; then
  # Create new user one time only. Add to the scanner group (created by SANE) and
  # lp group too (for Ubuntu)
  if ! id scanservjs >/dev/null 2>&1; then
    adduser --system --home $PATH_RUNTIME --no-create-home --disabled-password --quiet $USER
    adduser $USER $GROUP
    adduser $USER scanner
    adduser $USER lp 
  fi

  # Set permissions
  chown -R $USER:$GROUP $PATH_RUNTIME

  # Install node deps
  npm clean-install --omit=dev --only=prod --loglevel=error --prefix $PATH_LIB

  # Enable PDF
  sed -i 's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ /etc/ImageMagick-6/policy.xml

  # Avoid out of memory issues with large or multipage scans
  sed -i 's/policy domain="resource" name="disk" value="1GiB"/policy domain="resource" name="disk" value="8GiB"'/ /etc/ImageMagick-6/policy.xml
fi

# systemd updates
if [ "\$1" = "configure" ] || [ "\$1" = "abort-upgrade" ] || [ "\$1" = "abort-deconfigure" ] || [ "\$1" = "abort-remove" ]; then
  deb-systemd-helper unmask 'scanservjs.service' >/dev/null || true
  if deb-systemd-helper --quiet was-enabled 'scanservjs.service'; then
    # Create new symlinks, if any.
    deb-systemd-helper enable 'scanservjs.service' >/dev/null || true
  fi
  deb-systemd-helper update-state 'scanservjs.service' >/dev/null || true

  if [ -d /run/systemd/system ]; then
    systemctl --system daemon-reload >/dev/null || true
    deb-systemd-invoke restart 'scanservjs.service' >/dev/null || true
  fi
fi

# Message
if [ "\$1" = "configure" ] ; then
  if [ -d /var/www/scanservjs ]; then
    # Help migration
    echo
    echo "It looks as though you are already running version 2 of scanservjs. "
    echo "From version 3, the file locations have changed. If you want to maintain "
    echo "your old settings then you can do the following:"
    echo
    echo "  cp -v /var/www/scanservjs/data/output/* /srv/scanservjs/output/"
    echo "  sudo cp -v /var/www/scanservjs/config/*.local.js /etc/scanservjs/"
    echo
    echo "If you wish to go further then:"
    echo
    echo "  rm -rf /var/www/scanservjs"
    echo
  fi
  echo "scanservjs installed and running:  http://127.0.0.1:8080"
  echo
  echo "If you encounter problems see logs: journalctl -e -u scanservjs"
  echo
fi
EOF

# DEBIAN/prerm
cat > $DIR_DEBIAN/prerm << EOF
#!/bin/sh
if [ -d /run/systemd/system ] && [ "\$1" = remove ]; then
  deb-systemd-invoke stop 'scanservjs.service' >/dev/null || true
fi
EOF

# DEBIAN/postrm
cat > $DIR_DEBIAN/postrm << EOF
#!/bin/sh

# Remove all data
rm -rf $PATH_LIB
rm -rf $PATH_SYSTEMD/scanservjs.service

# Purge systemd
rm -f /etc/systemd/system/scanservjs.service
rm -f /var/lib/systemd/deb-systemd-helper-enabled/scanservjs.service.dsh-also
rm -f /var/lib/systemd/deb-systemd-helper-masked/scanservjs.service
if [ -d /var/lib/systemd/deb-systemd-helper-enabled ]; then
  rmdir --ignore-fail-on-non-empty /var/lib/systemd/deb-systemd-helper-enabled
fi
if [ -d /var/lib/systemd/deb-systemd-helper-masked ]; then
  rmdir --ignore-fail-on-non-empty /var/lib/systemd/deb-systemd-helper-masked
fi

# Let the user know about deleting other stuff
if [ "\$1" = "purge" ]; then
  echo "Consider removing the following. You will need root privileges:"
  echo "  userdel -r scanservjs"
  echo "  rf -rf $PATH_ETC $PATH_RUNTIME"
fi

# systemctl daemon-reload
if [ -d /run/systemd/system ] && [ "\$1" = "remove" ]; then
  systemctl --system daemon-reload >/dev/null || true
fi

# Check we can deal with systemd
[ -x "/usr/bin/deb-systemd-helper" ] || exit 0

if [ "\$1" = "remove" ]; then
  deb-systemd-helper mask 'scanservjs.service' >/dev/null || true
fi

if [ "\$1" = "purge" ]; then
  deb-systemd-helper purge 'scanservjs.service' >/dev/null || true
  deb-systemd-helper unmask 'scanservjs.service' >/dev/null || true
fi
EOF

# DEBIAN/conffiles
cat > $DIR_DEBIAN/conffiles << EOF
$PATH_ETC/config.default.js
EOF

# /usr/share/doc/scanservjs/copyright
cat > $DIR_DOC/copyright << EOF
Copyright: $(date +%Y) Sam Strachan <info@sbs20.com>

The entire code base may be distributed under the terms of the GNU General
Public License (GPL) 2

See /usr/share/common-licenses/GPL-2
EOF

# Permissions
chmod +x -v $DIR_DEBIAN/postinst
chmod +x -v $DIR_DEBIAN/postrm
chmod +x -v $DIR_DEBIAN/preinst
chmod +x -v $DIR_DEBIAN/prerm
chmod +x -v $DIR_LIB/server/server.js

# Build
dpkg-deb --root-owner-group --build ./debian ./debian/scanservjs_$VERSION-1.deb

# Optional linting
if [ "$1" = "--lint" ]; then
  lintian --suppress-tags dir-or-file-in-srv,no-changelog ./debian/scanservjs_$VERSION-1.deb
fi
