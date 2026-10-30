import "server-only";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/server/db/prisma";
import {
  isSafeArtworkObjectKey,
  isSafeMp4ObjectKey,
} from "@/domain/video-playback";

let client;

function getClient() {
  if (client) {
    return client;
  }

  const { AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } =
    process.env;

  if (
    !AWS_ENDPOINT_URL_S3 ||
    !AWS_ACCESS_KEY_ID ||
    !AWS_SECRET_ACCESS_KEY ||
    !AWS_REGION
  ) {
    throw new Error("Neon Object Storage environment variables are incomplete.");
  }

  client = new S3Client({
    endpoint: AWS_ENDPOINT_URL_S3,
    region: AWS_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

export async function getNeonVideoObject(key, range) {
  const bucketName = process.env.STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error("STORAGE_BUCKET is required for video playback.");
  }

  if (!isSafeMp4ObjectKey(key)) {
    throw new Error("The video asset must be a relative MP4 object key.");
  }

  return getClient().send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      Range: range,
    }),
  );
}

export async function createNeonVideoUpload(key, fileSizeBytes) {
  const bucketName = process.env.STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error("STORAGE_BUCKET is required for video uploads.");
  }
  if (!isSafeMp4ObjectKey(key)) {
    throw new Error("The video asset must be a relative MP4 object key.");
  }
  if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new Error("The video upload size must be a positive safe integer.");
  }

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: "video/mp4",
    }),
    { expiresIn: 900 },
  );

  return { uploadUrl, expiresInSeconds: 900 };
}

export async function verifyNeonVideoUpload(key) {
  const bucketName = process.env.STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error("STORAGE_BUCKET is required for video uploads.");
  }
  if (!isSafeMp4ObjectKey(key)) {
    throw new Error("The video asset must be a relative MP4 object key.");
  }

  return getClient().send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}

export async function createNeonArtworkUpload(key, contentType) {
  const bucketName = process.env.STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error("STORAGE_BUCKET is required for artwork uploads.");
  }
  if (!isSafeArtworkObjectKey(key)) {
    throw new Error("The artwork must use a supported movie artwork object key.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    throw new Error("Artwork must be JPEG, PNG, or WebP.");
  }

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 600 },
  );

  return { uploadUrl, expiresInSeconds: 600 };
}

export async function verifyNeonArtworkUpload(key) {
  const bucketName = process.env.STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error("STORAGE_BUCKET is required for artwork uploads.");
  }
  if (!isSafeArtworkObjectKey(key)) {
    throw new Error("The artwork must use a supported movie artwork object key.");
  }

  return getClient().send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}

export async function getNeonArtworkObject(key) {
  const bucketName = process.env.STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error("STORAGE_BUCKET is required for artwork delivery.");
  }
  if (!isSafeArtworkObjectKey(key)) {
    throw new Error("The artwork must use a supported movie artwork object key.");
  }

  return getClient().send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}

export async function deleteNeonUploadObject(key) {
  const bucketName = process.env.STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error("STORAGE_BUCKET is required for upload cleanup.");
  }
  if (!isSafeMp4ObjectKey(key) && !isSafeArtworkObjectKey(key)) {
    throw new Error("The object key is not a Vistara movie upload.");
  }

  await getClient().send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}

async function getBucketUsage(s3, bucketName) {
  let continuationToken;
  let objectCount = 0;
  let bytes = 0;

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of result.Contents ?? []) {
      objectCount += 1;
      bytes += object.Size ?? 0;

      if (!Number.isSafeInteger(bytes)) {
        throw new Error(`Storage usage for bucket "${bucketName}" is too large to measure safely.`);
      }
    }

    if (result.IsTruncated && !result.NextContinuationToken) {
      throw new Error(`Storage listing for bucket "${bucketName}" did not return a continuation token.`);
    }

    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  return { name: bucketName, objectCount, bytes };
}

export async function getNeonStorageInventory() {
  const s3 = getClient();
  const response = await s3.send(new ListBucketsCommand({}));
  const buckets = await Promise.all(
    (response.Buckets ?? [])
      .map((bucket) => bucket.Name)
      .filter(Boolean)
      .map((name) => getBucketUsage(s3, name)),
  );
  const branchBytes = buckets.reduce((total, bucket) => total + bucket.bytes, 0);
  const objectCount = buckets.reduce(
    (total, bucket) => total + bucket.objectCount,
    0,
  );

  if (!Number.isSafeInteger(branchBytes)) {
    throw new Error("Neon Object Storage usage is too large to measure safely.");
  }

  return {
    buckets,
    branchBytes,
    objectCount,
    configuredBucket: process.env.STORAGE_BUCKET ?? "",
  };
}

export async function getStorageHardLimit() {
  const savedSetting = await prisma.platformSetting.findUnique({
    where: { key: "storage.hardLimitBytes" },
    select: { value: true },
  });
  const value = savedSetting?.value ?? Number(process.env.STORAGE_HARD_LIMIT_BYTES);

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("The configured storage limit is not a valid byte count.");
  }

  return value;
}
