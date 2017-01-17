# installation

## SANE
Get [SANE installed and working](https://github.com/sbs20/scanserv/blob/master/install-sane.md) and 
check permissions etc

## nodejs & npm
Get nodejs and npm installed

e.g.
 * Arch: `sudo pacman -S nodejs npm`
 * Debian: `sudo apt-get install nodejs npm`


Note: Debian calls the node binary "nodejs", which results in npm not being able to find the command.
 Use one of the following to resolve the issue:
 * ln -s /usr/bin/nodejs /usr/bin/node
 * sudo apt-get install nodejs-legacy
 
See [run npm command gives error "/usr/bin/env: node: No such file or directory" #3911]
(https://github.com/nodejs/node-v0.x-archive/issues/3911#issuecomment-8956154) for more details.

## web app
Download the [latest release](https://github.com/sbs20/scanservjs/releases) and unzip.

e.g.
```
wget -O ~/scanservjs-release.zip https://github.com/sbs20/scanservjs/releases/download/v0.1.2/scanservjs_20170117.144056.zip
unzip scanservjs-release.zip -d scanserv-release && rm scanservjs-release.zip
```

Then see [install](install.sh)
