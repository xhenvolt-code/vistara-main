"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveAccessProduct, saveMovie, updateUserStatus } from "./actions";
import { ArtworkUploadField } from "./movies/artwork-upload-field";

function ActionMessage({ state }) {
  if (state?.error) {
    return (
      <p aria-live="polite" className="form-error" role="alert">
        {state.error}
      </p>
    );
  }

  if (state?.success) {
    return (
      <p aria-live="polite" className="form-success" role="status">
        {state.success}
      </p>
    );
  }

  return null;
}

export function MovieEditor({ movie, label = "Add a movie" }) {
  const [state, formAction, isPending] = useActionState(saveMovie, null);
  const [posterUrl, setPosterUrl] = useState(movie?.posterUrl ?? "");
  const [backdropUrl, setBackdropUrl] = useState(movie?.backdropUrl ?? "");

  return (
    <form action={formAction} className="admin-form">
      <input name="id" type="hidden" value={movie?.id ?? ""} />
      <div className="admin-form-grid">
        <label>
          Title
          <input
            defaultValue={movie?.title ?? ""}
            maxLength={160}
            name="title"
            required
          />
        </label>
        <label>
          URL slug (optional)
          <input
            defaultValue={movie?.slug ?? ""}
            maxLength={180}
            name="slug"
            placeholder="generated-from-title"
          />
        </label>
        <label>
          Release year
          <input
            defaultValue={movie?.releaseYear ?? ""}
            max={2200}
            min={1888}
            name="releaseYear"
            type="number"
          />
        </label>
        <label>
          Runtime (minutes)
          <input
            defaultValue={movie?.runtimeMinutes ?? ""}
            max={1000}
            min={1}
            name="runtimeMinutes"
            type="number"
          />
        </label>
        <label>
          Language
          <input
            defaultValue={movie?.language ?? ""}
            maxLength={80}
            name="language"
          />
        </label>
        <label>
          Director
          <input
            defaultValue={movie?.director ?? ""}
            maxLength={160}
            name="director"
          />
        </label>
        <label>
          Cast (comma-separated)
          <input
            defaultValue={movie?.cast?.join(", ") ?? ""}
            maxLength={3000}
            name="cast"
            placeholder="Actor One, Actor Two"
          />
        </label>
        <label>
          Content rating
          <input
            defaultValue={movie?.contentRating ?? ""}
            maxLength={30}
            name="contentRating"
            placeholder="e.g. 16+"
          />
        </label>
        <label>
          Genres (comma-separated)
          <input
            defaultValue={movie?.genres?.map(({ genre }) => genre.name).join(", ") ?? ""}
            name="genres"
            placeholder="Drama, Adventure"
          />
        </label>
        <div className="admin-media-field">
          <label htmlFor="poster-url">Poster image URL</label>
          <input
            id="poster-url"
            onChange={(event) => setPosterUrl(event.target.value)}
            value={posterUrl}
            name="posterUrl"
            placeholder="https://..."
            type="text"
          />
          <ArtworkUploadField
            currentUrl={posterUrl}
            movieId={movie?.id}
            onUploaded={setPosterUrl}
            purpose="poster"
          />
        </div>
        <div className="admin-media-field">
          <label htmlFor="backdrop-url">Backdrop image URL</label>
          <input
            id="backdrop-url"
            onChange={(event) => setBackdropUrl(event.target.value)}
            value={backdropUrl}
            name="backdropUrl"
            placeholder="https://..."
            type="text"
          />
          <ArtworkUploadField
            currentUrl={backdropUrl}
            movieId={movie?.id}
            onUploaded={setBackdropUrl}
            purpose="backdrop"
          />
        </div>
        <label>
          Catalogue status
          <select defaultValue={movie?.status ?? "DRAFT"} name="status">
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="UNPUBLISHED">Unpublished</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <label>
          Distribution rights
          <select
            defaultValue={movie?.rightsStatus ?? "PENDING"}
            name="rightsStatus"
          >
            <option value="PENDING">Pending review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <label className="admin-form-wide">
          Rights source / agreement reference
          <input
            defaultValue={movie?.rightsSource ?? ""}
            maxLength={500}
            name="rightsSource"
            placeholder="Contract or licence reference"
          />
        </label>
        <label className="admin-form-wide">
          Synopsis
          <textarea
            defaultValue={movie?.synopsis ?? ""}
            maxLength={5000}
            name="synopsis"
            rows={4}
          />
        </label>
      </div>

      <fieldset className="admin-form-fieldset">
        <p className="muted">
          Video assets must be uploaded and verified through the movie
          workspace. Publishing requires approved distribution rights, a
          recorded rights reference, and a verified ready video.
        </p>
      </fieldset>

      <label className="admin-checkbox">
        <input
          defaultChecked={movie?.isFeatured ?? false}
          name="isFeatured"
          type="checkbox"
        />
        Feature this title
      </label>
      <button className="button-primary" disabled={isPending} type="submit">
        {isPending ? "Saving..." : label}
      </button>
      <ActionMessage state={state} />
      {state?.movieId && (
        <p className="form-success">
          <Link className="text-link" href={`/admin/movies/${state.movieId}`}>
            Open the movie workspace to upload its video and finish setup
          </Link>
        </p>
      )}
    </form>
  );
}

export function ProductEditor({ product, label = "Add access product" }) {
  const [state, formAction, isPending] = useActionState(
    saveAccessProduct,
    null,
  );

  return (
    <form action={formAction} className="admin-form">
      <input name="id" type="hidden" value={product?.id ?? ""} />
      <div className="admin-form-grid">
        <label>
          Product name
          <input
            defaultValue={product?.name ?? ""}
            maxLength={100}
            name="name"
            required
          />
        </label>
        <label>
          Duration (days)
          <input
            defaultValue={product?.durationDays ?? 1}
            max={3650}
            min={1}
            name="durationDays"
            required
            type="number"
          />
        </label>
        <label>
          Price (UGX)
          <input
            defaultValue={product?.priceUgx ?? ""}
            max={10_000_000}
            min={500}
            name="priceUgx"
            required
            type="number"
          />
        </label>
        <label>
          Display order
          <input
            defaultValue={product?.sortOrder ?? 0}
            min={0}
            name="sortOrder"
            type="number"
          />
        </label>
      </div>
      <label className="admin-checkbox">
        <input
          defaultChecked={product?.isAvailable ?? false}
          name="isAvailable"
          type="checkbox"
        />
        Available for purchase
      </label>
      <button className="button-primary" disabled={isPending} type="submit">
        {isPending ? "Saving..." : label}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function UserStatusForm({ userId, status }) {
  const [state, formAction, isPending] = useActionState(
    updateUserStatus,
    null,
  );

  return (
    <form action={formAction} className="user-status-form">
      <input name="userId" type="hidden" value={userId} />
      <input
        name="status"
        type="hidden"
        value={status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"}
      />
      <button className="button-secondary" disabled={isPending} type="submit">
        {isPending
          ? "Saving..."
          : status === "ACTIVE"
            ? "Suspend"
            : "Reactivate"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}
