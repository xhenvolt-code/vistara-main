"use client";

import { useState } from "react";
import Link from "next/link";
import {
  formatVideoBytes,
  isValidMovieVideo,
  uploadMovieVideo,
} from "../video-upload-client";

export function MovieUploadForm() {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState("");
  const [message, setMessage] = useState("");
  const [movieId, setMovieId] = useState("");

  async function uploadFile(movieId, selectedFile) {
    setUploadStatus("uploading");
    setProgress(0);
    setSpeed("");
    setMessage("");

    try {
      await uploadMovieVideo(movieId, selectedFile, {
        onProgress(percent, bytesPerSecond) {
          setProgress(percent);
          setSpeed(bytesPerSecond ? `${formatVideoBytes(bytesPerSecond)}/s` : "");
        },
        onStatus: setMessage,
      });
      setUploadStatus("success");
      setMessage("Video uploaded and verified. Your draft movie is ready.");
    } catch (error) {
      setUploadStatus("error");
      setMessage(
        error instanceof Error ? error.message : "The video upload failed.",
      );
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isValidMovieVideo(file)) {
      setUploadStatus("error");
      setMessage("Choose an MP4 video file no larger than 5 GiB.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    if (title.length < 2 || title.length > 160) {
      setUploadStatus("error");
      setMessage("Enter a movie title between 2 and 160 characters.");
      return;
    }

    setUploadStatus("creating");
    setMessage("Creating the movie draft...");

    try {
      const response = await fetch("/api/admin/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The movie draft could not be created.");
      }

      setMovieId(result.movieId);
      await uploadFile(result.movieId, file);
    } catch (error) {
      setUploadStatus("error");
      setMessage(
        error instanceof Error ? error.message : "The movie could not be created.",
      );
    }
  }

  return (
    <div className="movie-upload-workflow">
      {!movieId && (
        <form className="movie-upload-form" onSubmit={handleSubmit}>
          <label className="video-upload-picker">
            <span>Movie video (MP4) <strong>Required</strong></span>
            <input
              accept="video/mp4,.mp4"
              disabled={uploadStatus === "creating" || uploadStatus === "uploading"}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setUploadStatus("idle");
                setMessage("");
              }}
              required
              type="file"
            />
          </label>
          {file && (
            <div className="video-upload-file">
              <strong>{file.name}</strong>
              <span>{formatVideoBytes(file.size)} · Maximum 5 GiB</span>
            </div>
          )}
          <label>
            Movie title <strong>Required</strong>
            <input
              autoComplete="off"
              maxLength={160}
              minLength={2}
              name="title"
              placeholder="Enter the movie title"
              required
            />
          </label>
          <button
            className="button-primary"
            disabled={
              uploadStatus === "creating" ||
              uploadStatus === "uploading" ||
              !isValidMovieVideo(file)
            }
            type="submit"
          >
            {uploadStatus === "creating"
              ? "Creating movie..."
              : uploadStatus === "uploading"
                ? "Uploading MP4..."
                : "Create movie and upload MP4"}
          </button>
        </form>
      )}

      {uploadStatus === "uploading" && (
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
          className={uploadStatus === "error" ? "form-error" : "muted"}
          role={uploadStatus === "error" ? "alert" : "status"}
        >
          {message}
          {speed && uploadStatus === "uploading" ? ` ${speed}` : ""}
        </p>
      )}
      {uploadStatus === "error" && !movieId && (
        <button
          className="button-secondary"
          onClick={() => setUploadStatus("idle")}
          type="button"
        >
          Try again
        </button>
      )}
      {uploadStatus === "error" && movieId && isValidMovieVideo(file) && (
        <button
          className="button-secondary"
          onClick={() => void uploadFile(movieId, file)}
          type="button"
        >
          Retry video upload
        </button>
      )}
      {movieId && (
        <Link className="text-link" href={`/admin/movies/${movieId}`}>
          {uploadStatus === "success"
            ? "Open movie workspace to add optional details"
            : "Open saved movie draft"}
        </Link>
      )}
      <p className="muted video-upload-disclaimer">
        Title and MP4 are the only required fields. You can add artwork, synopsis,
        cast, rights information, and other details from the movie workspace.
        MP4 uploads are limited to 5 GiB and are not transcoded.
      </p>
    </div>
  );
}
