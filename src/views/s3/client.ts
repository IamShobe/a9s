import { S3Client } from '@aws-sdk/client-s3';

export function createS3Client(endpointUrl?: string, region?: string): S3Client {
  return new S3Client({
    ...(region ? { region } : {}),
    ...(endpointUrl
      ? {
          endpoint: endpointUrl,
          forcePathStyle: true,
        }
      : {}),
  });
}
