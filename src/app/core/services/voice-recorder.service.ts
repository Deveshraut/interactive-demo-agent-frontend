// src/app/core/services/voice-recorder.service.ts
import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VoiceRecorderService {
  readonly recording = signal(false);
  readonly audioBlob$ = new Subject<Blob>();

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobEvent['data'][] = [];

  async start(): Promise<void> {
    if (this.recording()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this._getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType });
        this.audioBlob$.next(blob);
        // Release microphone
        stream.getTracks().forEach(t => t.stop());
        this.chunks = [];
      };

      this.mediaRecorder.start();
      this.recording.set(true);
    } catch (err) {
      console.error('[voice] microphone access failed:', err);
      throw err;
    }
  }

  stop(): void {
    if (!this.recording()) return;
    this.mediaRecorder?.stop();
    this.recording.set(false);
  }

  toggle(): Promise<void> {
    return this.recording() ? Promise.resolve(this.stop()) : this.start();
  }

  private _getSupportedMimeType(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm';
  }
}