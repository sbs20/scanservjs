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
