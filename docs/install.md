# installation

The easiest way to run is with Docker. But it's still possible to setup
manually.

## Manual Steps
* Get [SANE installed and working](./sane.md) and check permissions etc.
* Get nodejs and npm installed (You will need an up to date version of npm, you
  may need to run `npm install npm@latest -g`)
* Download the latest release of scanserv, extract it and run `install.sh`

## tl;dr; (Debian 10)

```
sudo apt install -y nodejs npm sane-utils imagemagick curl
sudo npm install npm@latest -g
wget -O ~/scanservjs.tar.gz $(curl -s https://api.github.com/repos/sbs20/scanservjs/releases/latest | grep browser_download_url | cut -d '"' -f 4)
mkdir scanservjs
tar -xf scanservjs.tar.gz -C ./scanservjs/
sudo ./scanservjs/install.sh
rm scanservjs.tar.gz
rm -r scanservjs
```

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