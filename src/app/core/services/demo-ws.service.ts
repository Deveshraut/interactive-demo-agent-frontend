// src/app/services/demo-ws.service.ts
import { Injectable, OnDestroy, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { DemoEvent, UserTextMessage, UserVoiceHeader, VideoTimestampMessage } from '../models/demo-events.models';

const WS_URL = 'ws://localhost:8000/ws';
const PING_INTERVAL_MS = 25_000;
const RECONNECT_DELAY_MS = 3_000;

@Injectable({ providedIn: 'root' })
export class DemoWsService implements OnDestroy {
  // Observable stream of inbound server events
  readonly events$ = new Subject<DemoEvent>();

  // Connection state signal for UI binding
  readonly connected = signal(false);

  private ws: WebSocket | null = null;
  private sessionId: string = crypto.randomUUID();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const url = `${WS_URL}/${this.sessionId}`;
    console.log('[ws] connecting →', url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[ws] connected');
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

    this.ws.onerror = (err) => {
      console.error('[ws] error', err);
    };

    this.ws.onclose = () => {
      console.log('[ws] disconnected');
      this.connected.set(false);
      this._stopPing();
      if (!this.destroyed) {
        setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      }
    };
  }

  sendText(text: string): void {
    const msg: UserTextMessage = { type: 'user_text', text };
    this._sendJson(msg);
  }

  sendTimestamp(timestamp: number): void {
    const msg: VideoTimestampMessage = { type: 'video_timestamp', timestamp };
    this._sendJson(msg);
  }

  /**
   * Two-frame voice protocol:
   *   Frame 1 — JSON header  { type: 'user_voice', mime: '...' }
   *   Frame 2 — raw bytes    <ArrayBuffer>
   */
  sendVoice(audioBlob: Blob): void {
    const header: UserVoiceHeader = { type: 'user_voice', mime: audioBlob.type || 'audio/webm' };
    this._sendJson(header);
    this.ws?.send(audioBlob);
  }

  disconnect(): void {
    this.destroyed = true;
    this._stopPing();
    this.ws?.close();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private _sendJson(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      console.warn('[ws] tried to send while disconnected', payload);
    }
  }

  private _startPing(): void {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      this._sendJson({ type: 'ping' });
    }, PING_INTERVAL_MS);
  }

  private _stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}