const { createReadStream } = require("fs");
const { PassThrough } = require("stream");
const ytdl = require("ytdl-core");
const yts = require("yt-search");
const FFmpegWrapper = require("./ffmpeg-wrapper");
const bytes = require("bytes");
const { createTempFile } = require("./utils");

exports.downloadAudio = (url, format, maxDlSize = "50MB") => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!ytdl.validateURL(url)) return reject(new Error("Invalid URL!"));
      let audioFormat;
      switch (format) {
        case "ogg":
          audioFormat = {
            fileExtension: "ogg",
            ffmpegOutputOptions: [
              "-c:a",
              "libvorbis",
              "-b:a",
              "128k",
              "-ar",
              48000
            ]
          };
          break;
        case "aac":
          audioFormat = {
            fileExtension: "m4a",
            ffmpegOutputOptions: ["-c:a", "aac", "-b:a", "128k", "-ar", 48000]
          };
          break;
        case "mp3":
          audioFormat = {
            fileExtension: "mp3",
            ffmpegOutputOptions: [
              "-c:a",
              "libmp3lame",
              "-b:a",
              "128k",
              "-ar",
              48000
            ]
          };
          break;
        case "wav":
          audioFormat = {
            fileExtension: "wav",
            ffmpegOutputOptions: [
              "-c:a",
              "pcm_s16le",
              "-b:a",
              "1411k",
              "-ar",
              48000
            ]
          };
          break;
        case "flac":
          audioFormat = {
            fileExtension: "flac",
            ffmpegOutputOptions: ["-c:a", "flac", "-b:a", "1411k", "-ar", 48000]
          };
          break;
        default:
          return reject(new Error("Format audio not found!"));
      }
      const info = await ytdl.getInfo(url);
      const { contentLength } = ytdl.chooseFormat(info.formats, {
        quality: 140
      });
      if (Number(contentLength) >= bytes(maxDlSize))
        return reject(
          new Error(
            `Sorry, the size of the file you downloaded exceeds the limit set by our system, which is ${maxDlSize}.`
          )
        );
      const outStream = new PassThrough();
      const inputStream = ytdl(url, { quality: 140 });
      const tempFile = createTempFile(audioFormat.fileExtension);
      new FFmpegWrapper()
        .setInput(inputStream)
        .setOutputOptions(audioFormat.ffmpegOutputOptions)
        .setOutput(tempFile.path)
        .on("close", code =>
          code
            ? tempFile.unlink()
            : createReadStream(tempFile.path)
                .on("error", err => outStream.emit("error", err))
                .pipe(outStream)
        )
        .on("error", err => outStream.emit("error", err))
        .run();
      outStream.on("end", tempFile.unlink);
      outStream.on("error", err => {
        tempFile.unlink();
        reject(err);
      });
      resolve(outStream);
    } catch (e) {
      reject(e);
    }
  });
};

exports.downloadVideo = (url, quality, maxDlSize = "50MB") => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!ytdl.validateURL(url)) return reject(new Error("Invalid URL!"));
      let vQuality;
      switch (quality) {
        case "240p":
          vQuality = 133;
          break;
        case "360p":
          vQuality = 134;
          break;
        case "480p":
          vQuality = 135;
          break;
        case "720p":
          vQuality = 136;
          break;
        case "1080p":
          vQuality = 137;
          break;
        default:
          return reject(new Error("Video quality not found!"));
      }
      let vSize = 0;
      const info = await ytdl.getInfo(url);
      for (const f of info.formats) {
        if (f.itag === 140 || f.itag === vQuality) {
          vSize += Number(f.contentLength);
        }
      }
      if (vSize >= bytes(maxDlSize))
        return reject(
          new Error(
            `Sorry, the size of the file you downloaded exceeds the limit set by our system, which is ${maxDlSize}.`
          )
        );
      const outStream = new PassThrough();
      const inputAudioStream = ytdl(url, { quality: 140 });
      const inputVideoStream = ytdl(url, { quality: vQuality });
      const tempFile = createTempFile("mkv");
      new FFmpegWrapper()
        .setInput(inputAudioStream)
        .setInput(inputVideoStream)
        .setOutputOptions(["-map", "0:a", "-map", "1:v", "-c:v", "copy"])
        .setOutput(tempFile.path)
        .on("close", code =>
          code
            ? tempFile.unlink()
            : createReadStream(tempFile.path)
                .on("error", err => outStream.emit("error", err))
                .pipe(outStream)
        )
        .on("error", err => outStream.emit("error", err))
        .run();
      outStream.on("end", tempFile.unlink);
      outStream.on("error", err => {
        tempFile.unlink();
        reject(err);
      });
      resolve(outStream);
    } catch (e) {
      reject(e);
    }
  });
};

const parseVideoData = data => {
  return {
    title: data.title,
    timestamp: data.timestamp,
    views: new Intl.NumberFormat("en-US", { notation: "compact" }).format(
      data.views
    ),
    genre: data.genre,
    ago: data.ago,
    channel: data.author.name,
    uploadDate: data.uploadDate,
    thumbnail: data.thumbnail,
    url: data.url,
    description: data.description
  };
};

exports.getInfo = url => {
  return new Promise((resolve, reject) => {
    ytdl.validateURL(url)
      ? yts({ videoId: ytdl.getVideoID(url) })
          .then(video => resolve(parseVideoData(video)))
          .catch(reject)
      : yts({ query: url })
          .then(({ videos }) => resolve(parseVideoData(videos.shift())))
          .catch(reject);
  });
};

exports.search = query => {
  return new Promise((resolve, reject) => {
    yts({ query })
      .then(({ videos }) => {
        const result = [];
        videos.forEach(video => result.push(parseVideoData(video)));
        resolve(result);
      })
      .catch(reject);
  });
};

exports.createTempFile = createTempFile;
exports.validateURL = ytdl.validateURL;
exports.getVideoID = ytdl.getVideoID;
exports.FFmpegWrapper = FFmpegWrapper;
