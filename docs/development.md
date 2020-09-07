# Development

## Setup

* Install Node
* Clone the repo
* Navigate to the repo directory
* then:

### Windows
```
npm install -g @vue/cli @vue/cli-service-global gulp-cli
npm install .
```

### Linux
```
sudo npm install -g @vue/cli @vue/cli-service-global gulp-cli
npm install .
```

## Run
```
npm run serve
```

## Build
```
gulp
```

or do a release:
```
gulp release
```

## Updating dependencies
* `npm audit fix` or `npm update`. This won't remove old packages. Delete node_modules and reinstall

## References
* [Run server with webpack](https://dennisreimann.de/articles/vue-cli-serve-express.html)

