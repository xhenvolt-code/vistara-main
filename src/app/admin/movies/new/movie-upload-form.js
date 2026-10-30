"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { saveMovie } from "../../actions";
import {
  formatVideoBytes,
  isValidMovieVideo,
  uploadMovieVideo,
} from "../video-upload-client";

export function MovieUploadForm() {
  const [state, formAction, isPending] = useActionState(saveMovie, null);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState("");
  const [message, setMessage] = useState("");
  const uploadStartedFor = useRef(null);

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

  useEffect(() => {
    if (
      isPending ||
      !state?.movieId ||
      !file ||
      uploadStartedFor.current === state.movieId
    ) {
      return;
    }

    uploadStartedFor.current = state.movieId;
    void uploadFile(state.movieId, file);
  }, [file, isPending, state]);

  function handleSubmit(event) {
    if (!isValidMovieVideo(file)) {
      event.preventDefault();
      setFileError("Choose an MP4 video file no larger than 5 GiB.");
      return;
    }
    setFileError("");
  }

  const movieId = state?.movieId;

  return (
    <div className="movie-upload-workflow">
      {!movieId && (
        <>
          <label className="video-upload-picker">
            <span>Movie video (MP4) <strong>Required</strong></span>
            <input
              accept="video/mp4,.mp4"
              disabled={isPending}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setFileError("");
                setUploadStatus("idle");
              }}
              type="file"
            />
          </label>
          {file && (
            <div className="video-upload-file">
              <strong>{file.name}</strong>
              <span>{formatVideoBytes(file.size)} · Maximum 5 GiB</span>
            </div>
          )}
          {fileError && (
            <p aria-live="polite" className="form-error" role="alert">
              {fileError}
            </p>
          )}
          <form action={formAction} className="admin-form" onSubmit={handleSubmit}>
            <input name="id" type="hidden" value="" />
            <input name="slug" type="hidden" value="" />
            <input name="synopsis" type="hidden" value="" />
            <input name="director" type="hidden" value="" />
            <input name="cast" type="hidden" value="" />
            <input name="contentRating" type="hidden" value="" />
            <input name="releaseYear" type="hidden" value="" />
            <input name="runtimeMinutes" type="hidden" value="" />
            <input name="language" type="hidden" value="" />
            <input name="posterUrl" type="hidden" value="" />
            <input name="backdropUrl" type="hidden" value="" />
            <input name="status" type="hidden" value="DRAFT" />
            <input name="rightsStatus" type="hidden" value="PENDING" />
            <input name="rightsSource" type="hidden" value="" />
            <input name="genres" type="hidden" value="" />
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
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Creating movie..." : "Create movie and upload MP4"}
            </button>
            {state?.error && (
              <p aria-live="polite" className="form-error" role="alert">
                {state.error}
              </p>
            )}
          </form>
        </>
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
