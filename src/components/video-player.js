"use client";

import { useState } from "react";

export function VideoPlayer({ title, src, poster, className = "" }) {
  const [message, setMessage] = useState("");

  return (
    <div className={`video-player ${className}`.trim()}>
      <video
        controls
        onCanPlay={() => setMessage("")}
        onError={() =>
          setMessage(
            "Video playback failed. Check the connection and try again. If the problem continues, contact Vistara support.",
          )
        }
        onWaiting={() => setMessage("Video is buffering...")}
        playsInline
        preload="metadata"
        poster={poster || undefined}
        aria-label={title}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support MP4 video playback.
      </video>
      {message && (
        <p aria-live="polite" className="video-player-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
