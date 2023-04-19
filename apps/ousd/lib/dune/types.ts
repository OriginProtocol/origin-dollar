export enum ExecutionState {
  COMPLETED = "QUERY_STATE_COMPLETED",
  EXECUTING = "QUERY_STATE_EXECUTING",
  PENDING = "QUERY_STATE_PENDING",
  CANCELLED = "QUERY_STATE_CANCELLED",
  FAILED = "QUERY_STATE_FAILED",
}

export interface ExecutionResponse {
  execution_id: string;
  state: ExecutionState;
}

export interface TimeData {
  submitted_at: Date;
  execution_started_at?: Date;
  execution_ended_at?: Date;
  expires_at?: Date;
  cancelled_at?: Date;
}

export interface ResultMetadata {
  column_names: string[];
  result_set_bytes: number;
  total_row_count: number;
  datapoint_count: number;
  pending_time_millis: number;
  execution_time_millis: number;
}

export interface BaseStatusResponse extends TimeData {
  execution_id: string;
  query_id: number;
}

export interface IncompleteStatusResponse extends BaseStatusResponse {
  state: Exclude<ExecutionState, ExecutionState.COMPLETED>;
  queue_position?: number;
}

export interface CompleteStatusResponse extends BaseStatusResponse {
  state: ExecutionState.COMPLETED;
  queue_position?: number;
  result_metadata: ResultMetadata;
}

export type GetStatusResponse =
  | IncompleteStatusResponse
  | CompleteStatusResponse;

export interface ExecutionResult {
  rows: Record<string, string>[];
  metadata: ResultMetadata;
}

export interface ResultsResponse extends TimeData {
  execution_id: string;
  query_id: number;
  state: ExecutionState;
  // only present when state is COMPLETE
  result?: ExecutionResult;
}
