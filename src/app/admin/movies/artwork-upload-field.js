"use client";

import { useEffect, useState } from "react";
import { MAX_ARTWORK_UPLOAD_BYTES } from "@/domain/video-playback";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function readJson(response) {
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || "The artwork request could not be completed.");
  }

  return body;
}

function putArtwork(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.floor((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `Storage rejected the image (HTTP ${request.status}). Check the storage bucket CORS configuration and retry.`,
          ),
        );
      }
    });
    request.addEventListener("error", () => {
      reject(new Error("The image upload failed. Check your connection and storage CORS settings."));
    });
    request.send(file);
  });
}

export function ArtworkUploadField({ movieId, purpose, onUploaded, currentUrl }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(currentUrl || "");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl(currentUrl || "");
      return undefined;
    }

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    return () => URL.revokeObjectURL(localUrl);
  }, [file, currentUrl]);

  async function uploadArtwork() {
    if (!file || !movieId || busy) {
      return;
    }

    setBusy(true);
    setMessage("Preparing artwork upload...");
    setProgress(0);

    try {
      const initResponse = await fetch(`/api/admin/movies/${movieId}/artwork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          fileSizeBytes: file.size,
          purpose,
        }),
      });
      const upload = await readJson(initResponse);
      setMessage("Uploading image directly to object storage...");
      await putArtwork(upload.uploadUrl, file, setProgress);

      const completeResponse = await fetch(
        `/api/admin/movies/${movieId}/artwork/${upload.assetKey}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: file.type,
            fileSizeBytes: file.size,
            purpose,
          }),
        },
      );
      const result = await readJson(completeResponse);
      onUploaded(result.artworkUrl);
      setUploaded(true);
      setMessage("Image uploaded and verified. Save movie changes to apply it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Artwork upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const invalidFile =
    file &&
    (!supportedTypes.has(file.type) ||
      file.size > MAX_ARTWORK_UPLOAD_BYTES);

  return (
    <div className="artwork-upload-field">
      {previewUrl && (
        <img
          alt={`${purpose === "poster" ? "Poster" : "Backdrop"} preview`}
          className={`artwork-preview artwork-preview-${purpose}`}
          src={previewUrl}
        />
      )}
      <label>
        Upload {purpose === "poster" ? "poster" : "backdrop"} image
        <input
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || !movieId}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setUploaded(false);
            setMessage("");
          }}
          type="file"
        />
      </label>
      {file && (
        <span className="artwork-file-info">
          {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB ·{" "}
          {file.type || "Unknown image format"}
        </span>
      )}
      {busy && (
        <progress aria-label={`${purpose} upload progress`} max="100" value={progress} />
      )}
      {message && (
        <span
          aria-live="polite"
          className={message.includes("failed") || message.includes("rejected") ? "form-error" : "muted"}
          role="status"
        >
          {message}
        </span>
      )}
      {!movieId && (
        <span className="muted">
          Save the movie record before uploading artwork.
        </span>
      )}
      {movieId && file && (
        <button
          className="button-secondary"
          disabled={busy || uploaded || Boolean(invalidFile)}
          onClick={uploadArtwork}
          type="button"
        >
          {busy ? "Uploading..." : uploaded ? "Image verified" : "Upload image"}
        </button>
      )}
      <span className="artwork-file-info">JPEG, PNG, or WebP up to 10 MB.</span>
    </div>
  );
}
