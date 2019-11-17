const assert = require('assert');
const { createHash } = require('crypto');
const fs = require('fs-extra');
const dlFile = require('../lib/index');

const url = 'http://ipv4.download.thinkbroadband.com/1MB.zip';
const headers = { 'user-agent': 'request' };
const expectedHash = 'f00be31bb73fe783209497d80aa1de89';

function checkFileMD5(filename, expectedHash) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(filename);

    const hb = createHash('md5');

    rs.pipe(hb);

    rs.on('close', () => {
      const hash = hb.digest('hex');

      assert.equal(hash, expectedHash, 'Hash mismatch');

      resolve(hash);
    })
  })
}

describe('dl-file', function() {
  it('should successfully download file', function() {

    const filename = `1MB-test-${Math.floor(Math.random() * 100000)}.zip`;

    this.timeout(60000);

    after('Cleanup files', function() {
      return fs.unlink(filename);
    })

    const opts = { url, headers };

    return dlFile(opts, filename)
      .then(filename => checkFileMD5(filename, expectedHash))
  });

  it('should resume download', function() {

    const filename = `1MB-test-${Math.floor(Math.random() * 100000)}.zip`;

    this.timeout(60000);

    after('Cleanup files', function() {
      return fs.unlink(filename);
    })

    return fs.copy('test/1MB-partial.zip', filename)
      .then(() => dlFile({ url, headers }, filename))
      .then(filename => checkFileMD5(filename, expectedHash));
  })
});
