"use client";

import { useState } from "react";

export function VideoPlayer({ title, src, poster, className = "" }) {
  const [message, setMessage] = useState("");

  function showPlaybackError(event) {
    const errorCode = event.currentTarget.error?.code;
    setMessage(
      errorCode === MediaError.MEDIA_ERR_DECODE
        ? "The video data could not be decoded. The source may be damaged or use an unsupported codec."
        : "The video could not be loaded. Check your connection and video access, then try again. If it continues, contact Vistara support.",
    );
  }

  return (
    <div className={`video-player ${className}`.trim()}>
      <video
        controls
        onCanPlay={() => setMessage("")}
        onError={showPlaybackError}
        onWaiting={() => setMessage("Video is buffering...")}
        playsInline
        preload="metadata"
        poster={poster || undefined}
        aria-label={title}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support HTML video playback.
      </video>
      {message && (
        <p aria-live="polite" className="video-player-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
