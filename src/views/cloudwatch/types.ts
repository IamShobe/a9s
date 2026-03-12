export interface AwsLogGroup {
  logGroupName: string;
  arn?: string;
  retentionInDays?: number;
  storedBytes?: number;
  creationTime?: number;
  metricFilterCount?: number;
}

export interface AwsLogStream {
  logStreamName: string;
  lastEventTimestamp?: number;
  firstEventTimestamp?: number;
  lastIngestionTime?: number;
  storedBytes?: number;
  uploadSequenceToken?: string;
}

export interface AwsLogEvent {
  timestamp: number;
  message: string;
  ingestionTime?: number;
}

export type CloudWatchLevel =
  | { kind: "log-groups" }
  | { kind: "log-streams"; logGroupName: string }
  | { kind: "log-events"; logGroupName: string; logStreamName: string };

export interface CloudWatchLogGroupMeta extends Record<string, unknown> {
  type: "log-group";
  logGroupName: string;
  logGroupArn: string;
  retentionInDays: number;
}

export interface CloudWatchLogStreamMeta extends Record<string, unknown> {
  type: "log-stream";
  logGroupName: string;
  logStreamName: string;
}

export interface CloudWatchLogEventMeta extends Record<string, unknown> {
  type: "log-event";
  logGroupName: string;
  logStreamName: string;
  timestamp: string;
  message: string;
}

export type CloudWatchRowMeta =
  | CloudWatchLogGroupMeta
  | CloudWatchLogStreamMeta
  | CloudWatchLogEventMeta;
