const { tmpdir } = require("os");
const { randomBytes } = require("crypto");
const { unlinkSync, existsSync, createWriteStream } = require("fs");
const { Readable } = require("stream");

exports.createTempFile = suffix => {
  const path = `${tmpdir()}/${randomBytes(15).toString("hex")}.${suffix}`;
  return {
    unlink: () => existsSync(path) && unlinkSync(path),
    path
  };
};

Readable.prototype.toFile = function (path) {
  return new Promise((resolve, reject) => {
    this.pipe(createWriteStream(path))
      .on("finish", resolve)
      .on("error", reject);
  });
};
