# Standard installation

## One line install

* If you don't already have your scanner working, then you need to get
  [SANE installed and working](./sane.md) and check permissions etc. Your
  scanner can be attached to a different server / device if you're using saned.
* If you're using a debian based distro then you can just use the installer
  script. But please note that this will install dependecies and needs to run as
  root:
  ```sh
  curl -s https://raw.githubusercontent.com/sbs20/scanservjs/master/packages/server/installer.sh | sudo bash -s -- -a
  ```
* If you're using Arch, then [@dadosch](https://github.com/dadosch) created a
  PKGBUILD script in Arch's AUR which allows Arch-distro-based users to quickly
  install and update scanservjs with any AUR helper, for example:
  `yay -S scanservjs`. See
  [package](https://aur.archlinux.org/packages/scanservjs/) for more.
* If you're using another distro, then for the time being you either need to
  manually run the steps in the install script or use docker.

## Manual download and install

If you don't fancy running a script directly from `curl` then you can manually
download the package and then run the installer inside.

```
wget -O ~/scanservjs.tar.gz $(curl -s https://api.github.com/repos/sbs20/scanservjs/releases/latest | grep browser_download_url | cut -d '"' -f 4)
mkdir scanservjs
tar -xf scanservjs.tar.gz -C ./scanservjs/
sudo ./scanservjs/installer.sh -i
rm scanservjs.tar.gz
rm -r scanservjs
```

## Troubleshooting

Scanservjs works by wrapping CLI calls to `scanimage` as the user `scanservjs`
which is a member of the `scanner` group. If connected by USB then we ultimately
need access to some hardware and that access may not be granted by default. To
debug where the problem is:

* First, check that you've followed the instructions [here](./sane.md).
* Try running `sudo scanimage -L` (for diagnostic purposes) - this really should
  work. If it doesn't, then it's most likely a SANE / driver related issue.
* Now try running as a normal user without sudo: `scanimage -L`. If you've
  installed scanservjs then there should be a `scanservjs` user. Try the same
  command as that user: `sudo su - scanservjs -c 'scanimage -L'`. If this
  doesn't show your scanner then most likely you need a udev rule (see
  [here](./sane.md)) to allow certain groups access to the hardware - but it's
  also worth verifying that the `scanservjs` user is a member of the `scanner`
  group (or the group specified in your udev rule): `groups scanservjs`.
* If everything so far has worked, then also try running a scan as the
  scanservjs user with
  `sudo su - scanservjs -c 'scanimage --format tiff > test.tif'` - this should
  output a tif file in the scanservjs home directory (probably
  `/home/scanservjs/`). If you can get this to work then scanservjs should be
  working fine.
* Getting logs: use `journalctl`. See the journalctl manpage for details but
  `sudo journalctl -e -u scanservjs` should be enough to get you started.

## Old Debian

For more on problems installing an up to date nodejs on Debian which includes
`npm`. See
[here](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions)

```console
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt install -y nodejs
sudo apt-get install npm sane-utils imagemagick
```

Debian calls the node binary "nodejs", which results in npm not being able to
find the command. Use one of the following to resolve the issue:
* `ln -s /usr/bin/nodejs /usr/bin/node`
* `sudo apt-get install nodejs-legacy`
 
See
[run npm command gives error "/usr/bin/env: node: No such file or directory" #3911](https://github.com/nodejs/node-v0.x-archive/issues/3911#issuecomment-8956154)
for more details.

## Arch

If you're using Arch, you probably don't need help but this worked a few years
ago `sudo pacman -S nodejs npm sane-utils imagemagick curl`