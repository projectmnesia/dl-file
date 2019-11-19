const fs = require('fs');
const path = require('path');
const request = require('request');
const throttle = require('lodash.throttle');
const debug = require('debug')('dl-file');

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

  filename = path.resolve(filename);

  debug(`Downloading ${opts.url} to ${filename}`);

  return new Promise((resolve, reject) => {
    fs.stat(filename, (err, stats) => {

      let downloadedBytes = 0,
        contentLength = 0;

      if (stats) {  // local exists
        // setup for byte range request
        opts.headers = opts.headers || {};

        debug(`${filename} exists at ${stats.size} bytes`);

        opts.headers.range = `bytes=${stats.size}-`;
      }

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

      const stream = request(opts)
        .on('response', response => {

          debug(response.headers);

          contentLength = parseInt(response.headers['content-length'])

          if (stats && contentLength === stats.size) {

            response.destroy();

            return resolve(filename);
          }

          let flagOpen = 'w';

          if (response.statusCode === 206) {
            flagOpen = 'a';
          }

          if (response.statusCode === 416) {

            const contentRange = response.headers['content-range'].match(/bytes \*\/([0-9]+)/);

            if (!contentRange) {
              return reject('No content-range header', response.headers);
            }

            const expectedSize = parseInt(contentRange[1]);

            if (expectedSize !== stats.size) {
              return reject('Local filesize doesnt match remote!');
            }

            console.log(`Already downloaded ${filename}`);

            return resolve(filename);
          }

          if (response.statusCode >= 300) {
            return reject(response.statusCode);
          }

          const ws = fs.createWriteStream(filename, {
            flags: flagOpen, // Open file for appending. The file is created if it does not exist.
            encoding: 'binary',
          });

          stream.on('data', chunk => {
            downloadedBytes += chunk.length;

            progressCb();
          })
          stream.pipe(ws)
        })
        .on('error', err => reject(err))
        .on('close', () => {
          resolve(filename)
        })
    })
  })
}

module.exports = downloadFile;
