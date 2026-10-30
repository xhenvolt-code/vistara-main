"use client";

import { MAX_VIDEO_UPLOAD_BYTES } from "../../../domain/video-playback.js";

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

export async function uploadMovieVideo(movieId, file, { onProgress, onStatus }) {
  let assetId;

  try {
    onStatus("Preparing a secure upload...");
    const initResponse = await fetch(`/api/admin/movies/${movieId}/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: "video/mp4",
        fileSizeBytes: file.size,
      }),
    });
    const upload = await readJson(initResponse);
    assetId = upload.assetId;
    onStatus("Uploading directly to Vistara video storage...");
    const startedAt = Date.now();

    await putFile(upload.uploadUrl, file, (loaded, total) => {
      const percent = Math.floor((loaded / total) * 100);
      const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.1);
      onProgress(percent, loaded / elapsedSeconds);
    });

    onStatus("Upload complete. Verifying the stored video...");
    const completeResponse = await fetch(
      `/api/admin/movies/${movieId}/uploads/${assetId}/complete`,
      { method: "POST" },
    );
    await readJson(completeResponse);
    onProgress(100, 0);
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

    throw new Error(failureMessage, { cause: error });
  }
}

export function isValidMovieVideo(file) {
  return Boolean(
    file &&
      file.size > 0 &&
      file.size <= MAX_VIDEO_UPLOAD_BYTES &&
      file.name.toLowerCase().endsWith(".mp4"),
  );
}

export function formatVideoBytes(bytes) {
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
