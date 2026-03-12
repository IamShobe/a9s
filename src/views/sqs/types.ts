export type SQSLevel =
  | { kind: "queues" }
  | { kind: "messages"; queueUrl: string; queueName: string };

export interface SQSQueueMeta extends Record<string, unknown> {
  type: "queue";
  queueUrl: string;
  queueArn: string;
  queueName: string;
  isFifo: boolean;
}

export interface SQSMessageMeta extends Record<string, unknown> {
  type: "message";
  messageId: string;
  receiptHandle: string;
  queueUrl: string;
}

export type SQSRowMeta = SQSQueueMeta | SQSMessageMeta;

export interface AwsSQSQueueAttributes {
  QueueArn?: string;
  ApproximateNumberOfMessages?: string;
  ApproximateNumberOfMessagesNotVisible?: string;
  CreatedTimestamp?: string;
  LastModifiedTimestamp?: string;
  VisibilityTimeout?: string;
  MessageRetentionPeriod?: string;
  DelaySeconds?: string;
  ReceiveMessageWaitTimeSeconds?: string;
  RedrivePolicy?: string;
  FifoQueue?: string;
}

export interface AwsSQSMessage {
  MessageId: string;
  ReceiptHandle: string;
  Body?: string;
  Attributes?: {
    SentTimestamp?: string;
    ApproximateFirstReceiveTimestamp?: string;
    ApproximateReceiveCount?: string;
  };
  MD5OfBody?: string;
}
