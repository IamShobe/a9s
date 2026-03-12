export type ECRLevel =
  | { kind: "repositories" }
  | { kind: "images"; repositoryName: string; repositoryUri: string };

export interface ECRRepoMeta extends Record<string, unknown> {
  type: "repository";
  repositoryName: string;
  repositoryUri: string;
  repositoryArn: string;
}

export interface ECRImageMeta extends Record<string, unknown> {
  type: "image";
  repositoryName: string;
  repositoryUri: string;
  imageDigest: string;
  imageTag: string;
}

export type ECRRowMeta = ECRRepoMeta | ECRImageMeta;

export interface AwsECRRepository {
  repositoryName: string;
  repositoryUri: string;
  repositoryArn: string;
  imageTagMutability?: string;
  imageScanningConfiguration?: { scanOnPush: boolean };
  encryptionConfiguration?: { encryptionType: string };
  createdAt?: string;
}

export interface AwsECRImage {
  imageDigest: string;
  imageTags?: string[];
  imagePushedAt?: string;
  imageSizeInBytes?: number;
  imageScanStatus?: { status: string };
}
