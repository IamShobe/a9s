export type CloudFrontLevel =
  | { kind: "distributions" }
  | { kind: "invalidations"; distributionId: string; domainName: string };

export interface CloudFrontDistributionMeta extends Record<string, unknown> {
  type: "distribution";
  distributionId: string;
  domainName: string;
  arn: string;
  status: string;
  enabled: boolean;
  comment: string;
  priceClass: string;
}

export interface CloudFrontInvalidationMeta extends Record<string, unknown> {
  type: "invalidation";
  invalidationId: string;
  distributionId: string;
  status: string;
  createdAt: string;
}

export type CloudFrontRowMeta = CloudFrontDistributionMeta | CloudFrontInvalidationMeta;

export interface AwsCFDistributionSummary {
  Id: string;
  ARN: string;
  Status: string;
  DomainName: string;
  Comment: string;
  Enabled: boolean;
  PriceClass: string;
  Origins: {
    Quantity: number;
    Items: Array<{ DomainName: string; Id: string }>;
  };
  Aliases?: {
    Quantity: number;
    Items?: string[];
  };
}

export interface AwsCFDistributionDetail {
  Distribution: {
    Id: string;
    ARN: string;
    Status: string;
    DomainName: string;
    DistributionConfig: {
      Comment: string;
      Enabled: boolean;
      PriceClass: string;
      HttpVersion: string;
      Aliases?: { Quantity: number; Items?: string[] };
      Origins: { Quantity: number; Items: Array<{ DomainName: string; Id: string }> };
      DefaultCacheBehavior?: { ViewerProtocolPolicy?: string };
      IsIPV6Enabled?: boolean;
      WebACLId?: string;
    };
  };
}

export interface AwsCFInvalidationSummary {
  Id: string;
  Status: string;
  CreateTime: string;
}

export interface AwsCFInvalidationDetail {
  Invalidation: {
    Id: string;
    Status: string;
    CreateTime: string;
    InvalidationBatch: {
      Paths: {
        Quantity: number;
        Items: string[];
      };
      CallerReference: string;
    };
  };
}
