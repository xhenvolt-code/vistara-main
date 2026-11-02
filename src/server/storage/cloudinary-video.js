import "server-only";
import { v2 as cloudinary } from "cloudinary";

export const PRIVATE_CLOUDINARY_PLAYBACK_PROFILE = "cloudinary:private:h264";
const tokenAccessControl = [{ access_type: "token" }];

export class CloudinaryPlaybackConfigurationError extends Error {
  constructor() {
    super(
      "CLOUDINARY_AUTH_TOKEN_KEY must be configured to play token-protected Cloudinary videos.",
    );
    this.name = "CloudinaryPlaybackConfigurationError";
  }
}

function getCloudinaryConfig() {
  const config = cloudinary.config();

  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    throw new Error("CLOUDINARY_URL must contain Cloudinary credentials.");
  }

  return config;
}

function getCloudinaryDeliveryType(playbackProfile) {
  return playbackProfile === PRIVATE_CLOUDINARY_PLAYBACK_PROFILE
    ? "private"
    : "authenticated";
}

export function createCloudinaryVideoUpload(publicId, type = "private") {
  const { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret } =
    getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const accessControl =
    type === "private" ? JSON.stringify(tokenAccessControl) : undefined;
  const signature = cloudinary.utils.api_sign_request(
    { public_id: publicId, timestamp, type, access_control: accessControl },
    apiSecret,
  );

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    apiKey,
    timestamp,
    signature,
    publicId,
    type,
    ...(accessControl ? { accessControl } : {}),
  };
}

export async function verifyCloudinaryVideoUpload(publicId, type = "private") {
  getCloudinaryConfig();
  return cloudinary.api.resource(publicId, {
    resource_type: "video",
    type,
  });
}

export async function deleteCloudinaryVideoAsset(publicId, type = "private") {
  getCloudinaryConfig();
  return cloudinary.uploader.destroy(publicId, {
    resource_type: "video",
    type,
    invalidate: true,
  });
}

export async function fetchCloudinaryVideo(publicId, range, playbackProfile) {
  getCloudinaryConfig();
  const authTokenKey = process.env.CLOUDINARY_AUTH_TOKEN_KEY;

  if (!authTokenKey || !/^(?:[a-f\d]{2})+$/i.test(authTokenKey)) {
    throw new CloudinaryPlaybackConfigurationError();
  }

  const isOnDemandTranscode =
    playbackProfile === PRIVATE_CLOUDINARY_PLAYBACK_PROFILE;
  const signedUrl = cloudinary.url(publicId, {
    resource_type: "video",
    type: getCloudinaryDeliveryType(playbackProfile),
    format: "mp4",
    force_version: false,
    sign_url: true,
    auth_token: false,
    secure: true,
    urlAnalytics: false,
    ...(isOnDemandTranscode
      ? {
          transformation: [
            {
              video_codec: "h264",
              audio_codec: "aac",
              quality: "auto",
            },
          ],
        }
      : {}),
  });
  const token = cloudinary.utils.generate_auth_token({
    key: authTokenKey,
    duration: 300,
    url: new URL(signedUrl).pathname,
  });
  const deliveryUrl = `${signedUrl}?${token}`;

  return fetch(deliveryUrl, {
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
  });
}
