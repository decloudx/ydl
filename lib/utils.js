const {tmpdir} = require('node:os');
const {randomBytes} = require('node:crypto');
const {unlinkSync, existsSync, createWriteStream} = require('node:fs');
const {Readable} = require('node:stream');

exports.createTempFile = suffix => {
	const path = `${tmpdir()}/${randomBytes(15).toString('hex')}.${suffix}`;
	return {
		unlink: () => existsSync(path) && unlinkSync(path),
		path,
	};
};

Readable.prototype.toFile = function (path) {
	return new Promise((resolve, reject) => {
		this.pipe(createWriteStream(path))
			.on('finish', resolve)
			.on('error', reject);
	});
};
