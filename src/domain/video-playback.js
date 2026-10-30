export const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
export const MAX_ARTWORK_UPLOAD_BYTES = 10 * 1024 * 1024;

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
