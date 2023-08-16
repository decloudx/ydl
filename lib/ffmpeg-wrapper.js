const stream = require('node:stream');
const cp = require('node:child_process');
const EventEmitter = require('node:events');

module.exports = class FFmpegWrapper extends EventEmitter {
	constructor(ffmpegPath = 'ffmpeg') {
		super();
		this.ioStream = {
			input: {
				readable: [],
				fds: [],
			},
			output: {
				writable: [],
				fds: [],
			},
		};
		this.args = [
			'-y',
			'-hide_banner',
			'-loglevel',
			'error',
			'-progress',
			'pipe:3',
		];
		this.ffmpegPath = ffmpegPath;
		this.stdio = ['pipe', 'pipe', 'pipe', 'pipe'];
	}

	setInput(input) {
		if (input instanceof stream.Readable) {
			this.args.push('-i', 'pipe:'.concat(this.stdio.length));
			this.ioStream.input.readable.push(input);
			this.ioStream.input.fds.push(this.stdio.length);
			this.stdio.push('pipe');
		} else {
			this.args.push('-i', input);
		}

		return this;
	}

	setOutput(output) {
		if (output instanceof stream.Writable) {
			this.args.push('pipe:'.concat(this.stdio.length));
			this.ioStream.output.writable.push(output);
			this.ioStream.output.fds.push(this.stdio.length);
			this.stdio.push('pipe');
		} else {
			this.args.push(output);
		}

		return this;
	}

	setInputOptions(options = []) {
		this.args.push(options);
		return this;
	}

	setOutputOptions(options = []) {
		this.args.push(options);
		return this;
	}

	setFFmpegOptions(options = []) {
		this.args.unshift(options);
		return this;
	}

	run() {
		const fProc = cp.spawn(this.ffmpegPath, this.args.flat(), {
			stdio: this.stdio,
		});

		// Input stream
		if (this.ioStream.input.readable.length > 0) {
			for (const [index, readable] of this.ioStream.input.readable.entries()) {
				const writable = fProc.stdio[this.ioStream.input.fds[index]];
				readable.on('error', error => {
				  writable.destroy();
					this.emit('ferror', error);
				});
				writable.on('error', error => {
					readable.destroy();
					this.emit('ferror', error);
				});
				readable.pipe(writable);
			}
		}

		// Output stream
		if (this.ioStream.output.writable.length > 0) {
			for (const [index, writable] of this.ioStream.output.writable.entries()) {
				const readable = fProc.stdio[this.ioStream.output.fds[index]];
				readable.on('error', error => {
				  writable.destroy();
					this.emit('ferror', error);
				});
				writable.on('error', error => {
					readable.destroy();
					this.emit('ferror', error);
				});
				readable.pipe(writable);
			}
		}

		fProc.on('error', error => {
			this.emit('ferror', error);
		});

		fProc.on('close', (code, signal) => {
			this.emit('close', code, signal);
		});

		fProc.stdio[3].on('data', data => {
			this.emit('progress', data.toString());
		});

		let errorMessage = '';
		fProc.stderr.on('data', data => errorMessage += data);
		fProc.stderr.on('end', () => {
		  if (errorMessage) {
		    this.emit('ferror', new Error(errorMessage));
		  }
		});
	}
};
