export interface AwsLambdaFunction {
  FunctionName: string;
  FunctionArn: string;
  Runtime?: string;
  Handler?: string;
  MemorySize?: number;
  Timeout?: number;
  LastModified?: string;
  Description?: string;
  Environment?: { Variables?: Record<string, string> };
  Layers?: Array<{ Arn: string; CodeSize?: number }>;
  VpcConfig?: {
    VpcId?: string;
    SubnetIds?: string[];
    SecurityGroupIds?: string[];
  };
  ReservedConcurrentExecutions?: number;
}

export interface AwsLambdaVersion {
  FunctionName: string;
  FunctionArn: string;
  Version: string;
  Description?: string;
  CodeSize?: number;
  LastModified?: string;
  Runtime?: string;
}

export type LambdaLevel =
  | { kind: "functions" }
  | { kind: "versions"; functionName: string; functionArn: string };

export interface LambdaFunctionMeta extends Record<string, unknown> {
  type: "function";
  functionName: string;
  functionArn: string;
  runtime: string;
}

export interface LambdaVersionMeta extends Record<string, unknown> {
  type: "version";
  functionName: string;
  functionArn: string;
  version: string;
}

export type LambdaRowMeta = LambdaFunctionMeta | LambdaVersionMeta;
