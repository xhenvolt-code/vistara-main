"use client";

import { useActionState } from "react";
import { saveAccessProduct, saveMovie, updateUserStatus } from "./actions";

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
  const videoAsset = movie?.videoAssets?.[0];

  return (
    <form action={formAction} className="admin-form">
      <input name="id" type="hidden" value={movie?.id ?? ""} />
      <input
        name="videoAssetId"
        type="hidden"
        value={videoAsset?.id ?? ""}
      />
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
          Genres (comma-separated)
          <input
            defaultValue={movie?.genres?.map(({ genre }) => genre.name).join(", ") ?? ""}
            name="genres"
            placeholder="Drama, Adventure"
          />
        </label>
        <label>
          Poster image URL
          <input
            defaultValue={movie?.posterUrl ?? ""}
            name="posterUrl"
            placeholder="https://..."
            type="url"
          />
        </label>
        <label>
          Backdrop image URL
          <input
            defaultValue={movie?.backdropUrl ?? ""}
            name="backdropUrl"
            placeholder="https://..."
            type="url"
          />
        </label>
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
        <legend>Playback asset</legend>
        <div className="admin-form-grid">
          <label>
            Provider
            <select
              defaultValue={videoAsset?.provider ?? ""}
              name="videoProvider"
            >
              <option value="">Not connected</option>
              <option value="CLOUDINARY">Cloudinary</option>
              <option value="NEON_OBJECT_STORAGE">Neon Object Storage</option>
            </select>
          </label>
          <label>
            Provider asset ID
            <input
              defaultValue={videoAsset?.providerAssetId ?? ""}
              maxLength={500}
              name="providerAssetId"
            />
          </label>
          <label>
            Playback profile
            <input
              defaultValue={videoAsset?.playbackProfile ?? ""}
              maxLength={200}
              name="playbackProfile"
            />
          </label>
          <label>
            Asset status
            <select
              defaultValue={videoAsset?.status ?? "PROCESSING"}
              name="videoStatus"
            >
              <option value="PROCESSING">Processing</option>
              <option value="READY">Ready</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </label>
        </div>
        <p className="muted">
          Publishing requires approved rights, a rights reference, and a ready
          playback asset. Confirm distribution rights before publishing.
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
