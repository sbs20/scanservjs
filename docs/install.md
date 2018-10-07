# installation

## tl;dr;
```
sudo apt install npm sane-utils imagemagick curl`
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt install -y nodejs
wget -O ~/scanservjs.tar.gz $(curl -s https://api.github.com/repos/sbs20/scanservjs/releases/latest | grep browser_download_url | cut -d '"' -f 4)
tar -xf scanservjs.tar.gz
sudo ./scanservjs/install.sh
rm scanservjs.tar.gz
rm -r scanservjs
```

## prerequisites
### SANE
Get [SANE installed and working](https://github.com/sbs20/scanserv/blob/master/install-sane.md) and 
check permissions etc.

### nodejs & npm
Get nodejs and npm installed

e.g.
#### Arch:
```
sudo pacman -S nodejs npm`
```
#### Debian 9:
```
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt install -y nodejs
sudo apt-get install npm sane-utils imagemagick`
```

For more on problems installing an up to date nodejs on Debian which includes
`npm`. See [here](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions)

Note 2: Debian calls the node binary "nodejs", which results in npm not being able to find the command.
Use one of the following to resolve the issue:
 * `ln -s /usr/bin/nodejs /usr/bin/node`
 * `sudo apt-get install nodejs-legacy`
 
See [run npm command gives error "/usr/bin/env: node: No such file or directory" #3911](https://github.com/nodejs/node-v0.x-archive/issues/3911#issuecomment-8956154) for more details.

## scanserv-js (the application)
Run the following:

```
wget -O ~/scanservjs.tar.gz $(curl -s https://api.github.com/repos/sbs20/scanservjs/releases/latest | grep browser_download_url | cut -d '"' -f 4)
tar -xf scanservjs.tar.gz
sudo ./scanservjs/install.sh
```

Or have a look at [other releases](https://github.com/sbs20/scanservjs/releases)

# development / build

  * Install nodejs
  * `npm install`
  * `npm install -g gulp-cli`
  * `gulp`
  * `cd ./build/scanservjs`
  * `node /server.js`
