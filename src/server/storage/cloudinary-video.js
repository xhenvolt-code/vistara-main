import "server-only";
import { v2 as cloudinary } from "cloudinary";

function getCloudinaryConfig() {
  const config = cloudinary.config();

  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    throw new Error("CLOUDINARY_URL must contain Cloudinary credentials.");
  }

  return config;
}

export function createCloudinaryVideoUpload(publicId) {
  const { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret } =
    getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const type = "authenticated";
  const signature = cloudinary.utils.api_sign_request(
    { public_id: publicId, timestamp, type },
    apiSecret,
  );

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    apiKey,
    timestamp,
    signature,
    publicId,
    type,
  };
}

export async function verifyCloudinaryVideoUpload(publicId) {
  getCloudinaryConfig();
  return cloudinary.api.resource(publicId, {
    resource_type: "video",
    type: "authenticated",
  });
}

export async function deleteCloudinaryVideoAsset(publicId) {
  getCloudinaryConfig();
  return cloudinary.uploader.destroy(publicId, {
    resource_type: "video",
    type: "authenticated",
    invalidate: true,
  });
}

export async function fetchCloudinaryVideo(publicId, range) {
  getCloudinaryConfig();
  const signedUrl = cloudinary.utils.private_download_url(publicId, "mp4", {
    resource_type: "video",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });

  return fetch(signedUrl, {
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
  });
}
