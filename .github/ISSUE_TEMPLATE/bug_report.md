---
name: Bug report
about: Create a report to help us improve
title: ''
labels: ''
assignees: ''

---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Client (please complete the following information):**
 - Browser [e.g. chrome, safari]
 - Version [e.g. 22]

**Server (please complete the following information):**
 - OS: [e.g. Debian 10]
 - Node version [e.g. 10.1]
 - NPM version [e.g. 6]
 - Docker version [e.g. 19]

**Logs**
 - Please include application logs (see commands below)
 
This may be useful
```sh
# Node version
echo "node: $(node -v)"

# NPM version
echo "npm: $(npm -v)"

# Docker version
echo "docker: $(docker -v)"

# OS version
cat /etc/*release | sed ':a;N;$!ba;s/\n/; /g'

# Logs if installed manually
sudo journalctl -u scanservjs | gzip > scanservjs.log.installed.txt.gz

# Logs if in docker
docker logs scanservjs-container > scanservjs.log.docker.txt
```

**Additional context**
Add any other context about the problem here.
