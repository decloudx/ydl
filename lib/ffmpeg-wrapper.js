const stream = require("stream");
const cp = require("child_process");
const EventEmitter = require("events");
const pathToFfmpeg = require("ffmpeg-static");

module.exports = class FFmpegWrapper extends EventEmitter {
  constructor() {
    super();
    this.ioStream = {
      input: {
        readable: [],
        fds: []
      },
      output: {
        writable: [],
        fds: []
      }
    };
    this.args = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-progress",
      "pipe:3"
    ];
    this.stdio = ["pipe", "pipe", "pipe", "pipe"];
  }

  setInput(input) {
    if (input instanceof stream.Readable) {
      this.args.push("-i", "pipe:".concat(this.stdio.length));
      this.ioStream.input.readable.push(input);
      this.ioStream.input.fds.push(this.stdio.length);
      this.stdio.push("pipe");
    } else {
      this.args.push("-i", input);
    }
    return this;
  }

  setOutput(output) {
    if (output instanceof stream.Writable) {
      this.args.push("pipe:".concat(this.stdio.length));
      this.ioStream.output.writable.push(output);
      this.ioStream.output.fds.push(this.stdio.length);
      this.stdio.push("pipe");
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
    const ffmpegProcess = cp.spawn(pathToFfmpeg, this.args.flat(), {
      stdio: this.stdio
    });
    if (this.ioStream.input.readable.length) {
      this.ioStream.input.readable.forEach((stream, index) => {
        stream
          .on("error", error => this.emit("error", error))
          .pipe(ffmpegProcess.stdio[this.ioStream.input.fds[index]])
          .on("error", error => this.emit("error", error));
      });
    }
    if (this.ioStream.output.writable.length) {
      this.ioStream.output.writable.forEach((stream, index) => {
        ffmpegProcess.stdio[this.ioStream.output.fds[index]]
          .on("error", error => this.emit("error", error))
          .pipe(stream)
          .on("error", error => this.emit("error", error));
      });
    }
    ffmpegProcess.on("error", error => this.emit("error", error));
    ffmpegProcess.on("close", (code, signal) =>
      this.emit("close", code, signal)
    );
    ffmpegProcess.stdio[3].on("data", data =>
      this.emit("progress", data.toString())
    );
    ffmpegProcess.stderr.on("data", data =>
      this.emit("error", data.toString())
    );
  }
};
