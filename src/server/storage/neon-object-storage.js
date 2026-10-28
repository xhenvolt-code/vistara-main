import "server-only";
import {
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { prisma } from "@/server/db/prisma";

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
