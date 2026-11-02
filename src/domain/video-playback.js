export const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
export const MAX_ARTWORK_UPLOAD_BYTES = 10 * 1024 * 1024;

const movieVideoFormats = {
  mp4: { contentType: "video/mp4", cloudinaryFormats: ["mp4"] },
  m4v: { contentType: "video/x-m4v", cloudinaryFormats: ["m4v", "mp4"] },
  mov: { contentType: "video/quicktime", cloudinaryFormats: ["mov", "qt"] },
  webm: { contentType: "video/webm", cloudinaryFormats: ["webm"] },
  mkv: { contentType: "video/x-matroska", cloudinaryFormats: ["mkv"] },
  avi: { contentType: "video/x-msvideo", cloudinaryFormats: ["avi"] },
  mpg: { contentType: "video/mpeg", cloudinaryFormats: ["mpg", "mpeg"] },
  mpeg: { contentType: "video/mpeg", cloudinaryFormats: ["mpg", "mpeg"] },
  ogv: { contentType: "video/ogg", cloudinaryFormats: ["ogv", "ogg"] },
  "3gp": { contentType: "video/3gpp", cloudinaryFormats: ["3gp"] },
};

export function getMovieVideoFormat(filename) {
  if (typeof filename !== "string") {
    return null;
  }

  const extension = filename.split(".").pop()?.toLowerCase();
  return movieVideoFormats[extension] ?? null;
}

export function isSafeMp4ObjectKey(key) {
  return (
    typeof key === "string" &&
    key.toLowerCase().endsWith(".mp4") &&
    !/^[a-z][a-z\d+.-]*:\/\//i.test(key) &&
    !key.startsWith("/") &&
    !key.split(/[\\/]/).includes("..")
  );
}

export function isSafeArtworkObjectKey(key) {
  return (
    typeof key === "string" &&
    /^movies\/[a-zA-Z0-9_-]{1,100}\/artwork\/[a-f0-9-]{36}\.(?:jpe?g|png|webp)$/i.test(
      key,
    )
  );
}

export function isValidByteRange(range) {
  return /^bytes=(?:\d+-\d*|-\d+)$/i.test(range);
}
