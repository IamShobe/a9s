import { S3Client } from '@aws-sdk/client-s3';

export function createS3Client(endpointUrl?: string): S3Client {
  return new S3Client({
    ...(endpointUrl
      ? {
          endpoint: endpointUrl,
          forcePathStyle: true,
        }
      : {}),
  });
}
