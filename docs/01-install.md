# Installation

## Debian

If you're using a debian based distro then you can just use the installer
script:

```sh
curl -s https://raw.githubusercontent.com/sbs20/scanservjs/master/bootstrap.sh | sudo bash -s -- -v latest
```

If you wish to install a specific version then you can do so:

```sh
curl -s https://raw.githubusercontent.com/sbs20/scanservjs/master/bootstrap.sh | sudo bash -s -- -v v2.23.0
```

Since v3.0.0, the oneline install is actually just downloading a `.deb` file.
You can do this yourself from the releases and then install it:
`sudo apt-get install ./scanservjs_3.0.0-1.deb`

### Note for users of `v2.x`

If you have `v2.x` of the application installed, then while you _can_ just
install `v3.x` over the top, it is strongly recommended to remove the old
version completely first. The main reason is that it will let debian keep track
of dependencies more effectively. Further, `v2.x` installs a version of npm
which is not only non-standard but now outdated. Sorry about that.

There is no automation for this because it's too invasive to do automatically
and it's a one-off process. Further, you may be using some of the packages that
this script proposes removing.

```sh
# Stop and remove service
sudo systemctl stop scanservjs > /dev/null
sudo rm -vf /etc/systemd/system/scanservjs.service
sudo systemctl daemon-reload

# backup scans to home directory
mkdir -p /tmp/scanservjs.bkp
sudo mv -v /var/www/scanservjs/data /tmp/scanservjs.bkp
sudo mv -v /var/www/scanservjs/config /tmp/scanservjs.bkp

# Remove all old application files
sudo rm -rvf /var/www/scanservjs

# Get rid of npm version update (prior to uninstalling npm)
sudo npm uninstall -g npm

# remove dependencies
sudo apt-get remove -yq \
  nodejs \
  npm \
  imagemagick \
  sane-utils \
  tesseract-ocr

sudo apt-get autoremove
```

To restore backed up files after install:

```sh
sudo cp -v /tmp/scanservjs.bkp/data/output/* /usr/lib/scanservjs/data/output
sudo cp -v /tmp/scanservjs.bkp/config/*.local.js /usr/lib/scanservjs/config
sudo chown $USER:$USER /usr/lib/scanservjs/data/output/*
```

Note that if you have a `config.local.js` then you may need to amend it to work
in `v3.x`. Please refer to the updated `config.default.js` or documentation to
reference the recommended pattern for using node `require(...)`.

## Arch

If you're using Arch, then [@dadosch](https://github.com/dadosch) created a
PKGBUILD script in [Arch's AUR](https://aur.archlinux.org/packages/scanservjs)
which allows Arch-distro-based users to quickly install and update scanservjs
with any AUR helper, for example: `yay -S scanservjs`. See
[package](https://aur.archlinux.org/packages/scanservjs/) for more.

## Other distros

If you're using another distro, then for the time being you either need to
manually run the steps in the install script or use docker.

## Uninstall

```sh
# Debian
sudo apt-get remove scanservjs

# Arch
sudo yay -R scanservjs
```

Note: For Debian pre `v3.0.0` use the old installer with the `-u` switch:
`sudo /var/www/scanservjs/installer.sh -u`. If you have installed `v3.0.0` then
this *may* interfere.
