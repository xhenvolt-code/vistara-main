"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatVideoBytes,
  isValidMovieVideo,
  uploadMovieVideo,
} from "./video-upload-client";

export function VideoUploadPanel({ movieId }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleUpload(event) {
    event.preventDefault();

    if (!isValidMovieVideo(file) || status === "uploading") {
      return;
    }

    setStatus("uploading");
    setProgress(0);
    setSpeed("");
    setMessage("");

    try {
      await uploadMovieVideo(movieId, file, {
        onProgress(loadedPercent, bytesPerSecond) {
          setProgress(loadedPercent);
          setSpeed(
            bytesPerSecond ? `${formatVideoBytes(bytesPerSecond)}/s` : "",
          );
        },
        onStatus: setMessage,
      });
      setStatus("success");
      setProgress(100);
      setMessage("Video uploaded and verified. It is now available for review.");
      setFile(null);
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "The upload failed unexpectedly.",
      );
    }
  }

  return (
    <form className="video-upload-panel" onSubmit={handleUpload}>
      <label className="video-upload-picker">
        <span>Choose an MP4 video</span>
        <input
          accept="video/mp4,.mp4"
          disabled={status === "uploading"}
          onChange={(event) => {
            const selectedFile = event.target.files?.[0] ?? null;
            setFile(selectedFile);
            setMessage("");
            setStatus("idle");
            setProgress(0);
            setSpeed("");
          }}
          type="file"
        />
      </label>
      {file && (
        <div className="video-upload-file">
          <strong>{file.name}</strong>
          <span>
            {formatVideoBytes(file.size)} · MP4 · Maximum 5 GiB
          </span>
        </div>
      )}
      {status === "uploading" && (
        <div
          aria-label={`Upload progress: ${progress}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="video-upload-progress"
          role="progressbar"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {message && (
        <p
          aria-live="polite"
          className={status === "error" ? "form-error" : "muted"}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
          {speed && status === "uploading" ? ` ${speed}` : ""}
        </p>
      )}
      <button
        className="button-primary"
        disabled={
          status === "uploading" || !isValidMovieVideo(file)
        }
        type="submit"
      >
        {status === "uploading" ? "Uploading..." : "Upload movie video"}
      </button>
      <p className="muted video-upload-disclaimer">
        Uploads go directly from this browser to the configured Neon Object
        Storage bucket. This workflow supports MP4 files up to 5 GiB; it does
        not transcode or create adaptive streaming versions.
      </p>
    </form>
  );
}
