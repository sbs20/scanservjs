# scanservjs
scanservjs is a nodejs port of scanserv. It's a simple web-based UI for SANE 
which allows you to share a scanner on a network without the need for drivers 
or complicated installation. scanservjs does not do image conversion or 
manipulation (beyond the bare minimum necessary for the purposes of browser 
preview) or OCR.

![screenshot](https://github.com/sbs20/scanservjs/raw/master/docs/screen0.png)

Copyright 2016	[Sam Strachan](https://github.com/sbs20)

# requirements
  * SANE
  * ImageMagick
  * nodejs

# installation notes
For an easy docker-based install (assuming that SANE supports your scanner out-of-the-box on Debian):

```console
$ docker build -t scanservjs .
$ docker run -p 8080:8080 --restart unless-stopped --name scanservjs --privileged scanservjs
```
(`--privileged` is required for the container to access the host's devices, to allow it to talk to the scanner)

scanservjs will now be accessible from `http://your-computer's-ip-here:8080/`

## manual installation
 * See the installation notes [here](docs/install.md)

# background
This is yet another scanimage-web-front-end. Why?

 * I wanted a simple server which would simply scan an image with as little
   dependency on other software as possible. I already have Photoshop / GIMP
   I don't need a webapp to do that stuff
 * Desire for easier and cleaner set up and configuration
 * Separation of presentation and control logic with json-rpc
 * I just wanted to

# roadmap
 * ES2016
 * Setup page (auto diagnostics)
 * Configuration page for debugging set up assisting new users
 * Multi-language support

# acknowledgements
 * This project owes a lot to [phpsane](http://sourceforge.net/projects/phpsane/)
 * In many respects phpsane is more powerful than this. Scanservjs does not 
   support jpeg conversion or OCR. phpSANE, however, is also more brittle and 
   somewhat dated in its implementation.
   
# more about SANE
 * http://www.sane-project.org/