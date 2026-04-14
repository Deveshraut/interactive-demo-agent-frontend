import { Injectable, OnDestroy, signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  DemoEvent, UserTextMessage, UserVoiceHeader, VideoTimestampMessage
} from '../models/demo-events.models';

const WS_URL             = 'ws://localhost:8000/ws';
const PING_INTERVAL_MS   = 25_000;
const RECONNECT_DELAY_MS = 3_000;

@Injectable({ providedIn: 'root' })
export class DemoWsService implements OnDestroy {
  readonly events$   = new Subject<DemoEvent>();
  readonly connected = signal(false);

  private ws:            WebSocket | null = null;
  private sessionId:     string           = crypto.randomUUID();
  private pingTimer:     ReturnType<typeof setInterval> | null = null;
  private destroyed      = false;
  private autoReconnect  = true;

  // ── Public API ─────────────────────────────────────────────────────────────

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const url = `${WS_URL}/${this.sessionId}`;
    console.log('[ws] connecting →', url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[ws] connected — session:', this.sessionId);
      this.connected.set(true);
      this._startPing();
    };

    this.ws.onmessage = (evt: MessageEvent) => {
      try {
        const event: DemoEvent = JSON.parse(evt.data as string);
        this.events$.next(event);
      } catch (e) {
        console.error('[ws] failed to parse message:', evt.data);
      }
    };

    this.ws.onerror = (err) => console.error('[ws] error', err);

    this.ws.onclose = () => {
      console.log('[ws] disconnected');
      this.connected.set(false);
      this._stopPing();
      if (!this.destroyed && this.autoReconnect) {
        setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      }
    };
  }

  /**
   * Called when the user resets to the workflow selector after a completed demo.
   * Generates a fresh session ID so the backend creates a new LangGraph thread.
   * The old completed thread in Redis cannot accept new invoke() calls.
   */
  reconnectWithNewSession(): void {
    this.autoReconnect = false;
    this.ws?.close();
    this.sessionId    = crypto.randomUUID();
    this.autoReconnect = true;
    console.log('[ws] new session →', this.sessionId);
    setTimeout(() => this.connect(), 100);
  }

  sendText(text: string): void {
    this._sendJson({ type: 'user_text', text } satisfies UserTextMessage);
  }

  sendTimestamp(timestamp: number): void {
    this._sendJson({ type: 'video_timestamp', timestamp } satisfies VideoTimestampMessage);
  }

  /**
   * Two-frame voice protocol:
   *   Frame 1 — JSON  { type: 'user_voice', mime: '...' }
   *   Frame 2 — bytes  <Blob>
   */
  sendVoice(audioBlob: Blob): void {
    const header: UserVoiceHeader = {
      type: 'user_voice',
      mime: audioBlob.type || 'audio/webm',
    };
    this._sendJson(header);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioBlob);
    }
  }

  disconnect(): void {
    this.destroyed     = true;
    this.autoReconnect = false;
    this._stopPing();
    this.ws?.close();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _sendJson(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      console.warn('[ws] tried to send while disconnected', payload);
    }
  }

  private _startPing(): void {
    this._stopPing();
    this.pingTimer = setInterval(
      () => this._sendJson({ type: 'ping' }),
      PING_INTERVAL_MS,
    );
  }

  private _stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}