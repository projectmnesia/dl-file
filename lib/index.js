const fs = require('fs');
const request = require('request');
const throttle = require('lodash.throttle');

function requestHead(opts) {
  return new Promise((resolve, reject) => {
    request({ ...opts, method: 'head' })
      .on('error', err => reject(err))
      .on('response', response => {
        if (response.statusCode !== 200) {
          return reject(response.statusCode);
        }

        resolve(response.headers);
      })
  })
}

function downloadFile(opts, filename, progressCb, progressThrottle) {
  if (typeof opts === 'string') {
    opts = { url: opts };
  }

  if (!filename) {
    return Promise.reject('No filename provided');
  }

  return new Promise((resolve, reject) => {
    fs.stat(filename, (err, stats) => {
      requestHead(opts)
        .then(headers => {
          const contentLength = parseInt(headers['content-length']);

          let downloadedBytes = 0;

          if (stats) {  // local exists
            if (stats.size > contentLength) {
              return reject('Local filesize exceeds remote');
            }

            if (stats.size === contentLength) {
              return resolve(filename);
            }

            // setup for byte range request
            opts.headers.range = `bytes=${stats.size}-`;
          }

          const ws = fs.createWriteStream(filename, {
            flags: 'a', // Open file for appending. The file is created if it does not exist.
            encoding: 'binary',
          });

          if (typeof progressCb === 'function') {
            progressThrottle = progressThrottle || 1000;

            const _progressCb = progressCb;

            progressCb = throttle(function() {
              const progress = {
                totalSize: contentLength,
                downloadedBytes: (stats ? stats.size : 0) + downloadedBytes,
              }

              _progressCb(progress);
            }, progressThrottle);
          } else {
            progressCb = function() {};
          }

          request(opts)
            .on('response', response => {
              if (response.statusCode >= 300) {
                return reject(response.statusCode);
              }
            })
            .on('data', chunk => {
              downloadedBytes += chunk.length;

              progressCb();
            })
            .on('error', err => reject(err))
            .on('close', () => {
              resolve(filename)
            })
            .pipe(ws)
        })
    })
  })
}

module.exports = downloadFile;
