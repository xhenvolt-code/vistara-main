import assert from "node:assert/strict";
import test from "node:test";
import {
  isSafeArtworkObjectKey,
  isSafeMp4ObjectKey,
  isValidByteRange,
} from "../src/domain/video-playback.js";
import { isValidMovieVideo } from "../src/app/admin/movies/video-upload-client.js";

test("Neon playback accepts relative MP4 object keys", () => {
  assert.equal(isSafeMp4ObjectKey("films/title.mp4"), true);
  assert.equal(isSafeMp4ObjectKey("films/title.MP4"), true);
});

test("Neon playback rejects unsafe or unsupported object keys", () => {
  assert.equal(isSafeMp4ObjectKey("../title.mp4"), false);
  assert.equal(isSafeMp4ObjectKey("films/../title.mp4"), false);
  assert.equal(isSafeMp4ObjectKey("/films/title.mp4"), false);
  assert.equal(isSafeMp4ObjectKey("https://cdn.example/title.mp4"), false);
  assert.equal(isSafeMp4ObjectKey("films/title.m3u8"), false);
  assert.equal(isSafeMp4ObjectKey(""), false);
});

test("artwork storage accepts only scoped movie artwork keys", () => {
  assert.equal(
    isSafeArtworkObjectKey(
      "movies/cmovie123/artwork/550e8400-e29b-41d4-a716-446655440000.webp",
    ),
    true,
  );
  assert.equal(isSafeArtworkObjectKey("movies/other/poster.jpg"), false);
  assert.equal(
    isSafeArtworkObjectKey(
      "movies/../../private/artwork/550e8400-e29b-41d4-a716-446655440000.jpg",
    ),
    false,
  );
});

test("playback accepts a single HTTP byte range", () => {
  assert.equal(isValidByteRange("bytes=0-"), true);
  assert.equal(isValidByteRange("bytes=0-1023"), true);
  assert.equal(isValidByteRange("bytes=-1024"), true);
});

test("playback rejects malformed and multipart byte ranges", () => {
  assert.equal(isValidByteRange("items=0-10"), false);
  assert.equal(isValidByteRange("bytes=abc-def"), false);
  assert.equal(isValidByteRange("bytes=0-10,20-30"), false);
});

test("movie upload accepts MP4 files up to 5 GiB", () => {
  assert.equal(isValidMovieVideo({ name: "film.mp4", size: 1024 }), true);
  assert.equal(
    isValidMovieVideo({ name: "film.MP4", size: 5 * 1024 * 1024 * 1024 }),
    true,
  );
  assert.equal(isValidMovieVideo({ name: "film.mov", size: 1024 }), false);
  assert.equal(
    isValidMovieVideo({ name: "film.mp4", size: 5 * 1024 * 1024 * 1024 + 1 }),
    false,
  );
  assert.equal(isValidMovieVideo(null), false);
});
