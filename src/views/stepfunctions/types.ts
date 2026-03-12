export type StepFunctionsLevel =
  | { kind: "state-machines" }
  | { kind: "executions"; stateMachineArn: string; stateMachineName: string };

export interface SFNStateMachineMeta extends Record<string, unknown> {
  type: "state-machine";
  stateMachineArn: string;
  stateMachineName: string;
  stateMachineType: string;
}

export interface SFNExecutionMeta extends Record<string, unknown> {
  type: "execution";
  executionArn: string;
  stateMachineArn: string;
  stateMachineName: string;
  status: string;
}

export type SFNRowMeta = SFNStateMachineMeta | SFNExecutionMeta;

export interface AwsSFNStateMachine {
  stateMachineArn: string;
  name: string;
  type?: "STANDARD" | "EXPRESS";
  creationDate?: string;
}

export interface AwsSFNExecution {
  executionArn: string;
  stateMachineArn: string;
  name: string;
  status: string;
  startDate?: string;
  stopDate?: string;
}
