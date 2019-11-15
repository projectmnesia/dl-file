# dl-file

Promise based HTTP file downloader

```js
fetch(url, filename)
  .then(filename => console.log(`Saved to ${filename}`));
```

With progress support
```js
function progressFunc(progress) {
  console.log(`Downloaded ${progress.downloadedBytes} of ${progress.totalSize}`);
}
const progressThrottle = 600;

fetch(url, filename, progressFunc, progressThrottle);
```

progressThrottle determines how often the progressFunc is called, default is 1000ms
