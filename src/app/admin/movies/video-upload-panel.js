"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_VIDEO_UPLOAD_BYTES } from "@/domain/video-playback";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown size";
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function readJson(response) {
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || "The request could not be completed.");
  }

  return body;
}

function putFile(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", "video/mp4");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `Storage rejected the upload (HTTP ${request.status}). Check the storage bucket CORS configuration and retry.`,
          ),
        );
      }
    });
    request.addEventListener("error", () => {
      reject(
        new Error(
          "The upload connection failed. Check your network and storage bucket CORS configuration, then retry.",
        ),
      );
    });
    request.addEventListener("abort", () => reject(new Error("Upload was cancelled.")));
    request.send(file);
  });
}

export function VideoUploadPanel({ movieId }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleUpload(event) {
    event.preventDefault();

    if (!file || status === "uploading") {
      return;
    }

    setStatus("uploading");
    setProgress(0);
    setSpeed("");
    setMessage("Preparing a secure upload...");
    let assetId;

    try {
      const initResponse = await fetch(`/api/admin/movies/${movieId}/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "video/mp4",
          fileSizeBytes: file.size,
        }),
      });
      const upload = await readJson(initResponse);
      assetId = upload.assetId;
      setMessage("Uploading directly to Vistara video storage...");
      const startedAt = Date.now();

      await putFile(upload.uploadUrl, file, (loaded, total) => {
        const percent = Math.floor((loaded / total) * 100);
        const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.1);
        setProgress(percent);
        setSpeed(`${formatBytes(loaded / elapsedSeconds)}/s`);
      });

      setMessage("Upload complete. Verifying the stored video...");
      const completeResponse = await fetch(
        `/api/admin/movies/${movieId}/uploads/${assetId}/complete`,
        { method: "POST" },
      );
      await readJson(completeResponse);
      setStatus("success");
      setProgress(100);
      setMessage("Video uploaded and verified. It is now available for review.");
      setFile(null);
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      let failureMessage =
        error instanceof Error ? error.message : "The upload failed unexpectedly.";

      if (assetId) {
        try {
          const failureResponse = await fetch(
            `/api/admin/movies/${movieId}/uploads/${assetId}/fail`,
            { method: "POST" },
          );
          if (!failureResponse.ok) {
            failureMessage += " The upload status could not be updated; refresh the workspace.";
          }
        } catch (failureError) {
          console.error("Could not update failed movie upload status.", failureError);
          failureMessage += " The upload status could not be updated; refresh the workspace.";
        }
      }

      setStatus("error");
      setMessage(failureMessage);
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
            {formatBytes(file.size)} · MP4 · Maximum 5 GiB
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
          status === "uploading" ||
          !file ||
          file.size > MAX_VIDEO_UPLOAD_BYTES ||
          !file.name.toLowerCase().endsWith(".mp4")
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
