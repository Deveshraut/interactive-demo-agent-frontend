// src/app/models/demo-events.model.ts

export interface WorkflowSummary {
  workflow_id: string;
  name: string;
}

export interface Segment {
  id: number;
  title: string;
  start: number;
  end: number;
  narration_text: string;
}

// ── Inbound events (server → client) ─────────────────────────────────────────

export interface WorkflowListEvent {
  type: 'workflow_list';
  workflows: WorkflowSummary[];
}

export interface SegmentStartEvent {
  type: 'segment_start';
  index: number;
  title: string;
  narration_text: string;
  video_start: number;
  video_end: number;
}

export interface AgentAnswerEvent {
  type: 'agent_answer';
  text: string;
  audio_b64: string | null;
}

export interface VideoControlEvent {
  type: 'video_control';
  action: 'play' | 'pause' | 'seek';
  timestamp?: number;
}

export interface DemoCompleteEvent {
  type: 'demo_complete';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export interface AwaitingEvent {
  type: 'awaiting';
}

export interface PongEvent {
  type: 'pong';
}

export type DemoEvent =
  | WorkflowListEvent
  | SegmentStartEvent
  | AgentAnswerEvent
  | VideoControlEvent
  | DemoCompleteEvent
  | ErrorEvent
  | AwaitingEvent
  | PongEvent;

// ── Outbound messages (client → server) ───────────────────────────────────────

export interface UserTextMessage {
  type: 'user_text';
  text: string;
}

export interface UserVoiceHeader {
  type: 'user_voice';
  mime: string;
}

export interface VideoTimestampMessage {
  type: 'video_timestamp';
  timestamp: number;
}

// ── UI state ──────────────────────────────────────────────────────────────────

export type DemoStatus =
  | 'disconnected'
  | 'connecting'
  | 'listing'
  | 'loading'
  | 'narrating'
  | 'awaiting'
  | 'complete';