export type SNSLevel =
  | { kind: "topics" }
  | { kind: "subscriptions"; topicArn: string; topicName: string };

export interface SNSTopicMeta extends Record<string, unknown> {
  type: "topic";
  topicArn: string;
  topicName: string;
}

export interface SNSSubscriptionMeta extends Record<string, unknown> {
  type: "subscription";
  subscriptionArn: string;
  topicArn: string;
  protocol: string;
  endpoint: string;
}

export type SNSRowMeta = SNSTopicMeta | SNSSubscriptionMeta;

export interface AwsSNSTopicAttributes {
  TopicArn?: string;
  DisplayName?: string;
  SubscriptionsConfirmed?: string;
  SubscriptionsPending?: string;
  SubscriptionsDeleted?: string;
  Owner?: string;
  KmsMasterKeyId?: string;
  FifoTopic?: string;
}

export interface AwsSNSTopic {
  TopicArn: string;
}

export interface AwsSNSSubscription {
  SubscriptionArn: string;
  TopicArn: string;
  Protocol: string;
  Endpoint: string;
  Owner: string;
}
