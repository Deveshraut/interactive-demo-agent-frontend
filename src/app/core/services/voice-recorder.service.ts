// src/app/services/voice-recorder.service.ts
import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

const SILENCE_THRESHOLD   = 8;      // RMS 0-100 below this = silence
const SILENCE_DURATION_MS = 3000;   // stop after 3s of silence
const MIN_RECORD_MS       = 600;    // don't detect silence in first 600ms

@Injectable({ providedIn: 'root' })
export class VoiceRecorderService {
  readonly recording   = signal(false);
  readonly audioBlob$  = new Subject<Blob>();

  private mediaRecorder:  MediaRecorder | null = null;
  private stream:         MediaStream | null   = null;
  private chunks:         Blob[]               = [];
  private audioContext:   AudioContext | null  = null;
  private silenceTimer:   ReturnType<typeof setTimeout> | null = null;
  private rafHandle:      number | null        = null;
  private mimeType        = 'audio/webm';
  private emitOnStop      = true;

  // ── Public API ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.recording()) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;
    this.mimeType = this._getSupportedMimeType();
    this.emitOnStop = true;

    this.mediaRecorder = new MediaRecorder(stream, { mimeType: this.mimeType });
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      if (this.emitOnStop && this.chunks.length > 0) {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this.audioBlob$.next(blob);
      }
      this._cleanupRecorder();
    };

    this.mediaRecorder.start(100); // collect chunks every 100ms
    this.recording.set(true);

    // Start silence detection after minimum recording time
    setTimeout(() => {
      if (this.recording()) {
        this._setupSilenceDetection(stream);
      }
    }, MIN_RECORD_MS);
  }

  stop(): void {
    if (!this.recording()) return;
    this.emitOnStop = true;
    this._teardownSilenceDetection();
    this.recording.set(false);
    this.mediaRecorder?.stop();
  }

  cancel(): void {
    this.emitOnStop = false;
    this._teardownSilenceDetection();
    this.recording.set(false);

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      return;
    }

    this._cleanupRecorder();
  }

  // ── Silence detection ──────────────────────────────────────────────────────

  private _setupSilenceDetection(stream: MediaStream): void {
    try {
      this.audioContext = new AudioContext();
      const analyser    = this.audioContext.createAnalyser();
      analyser.fftSize  = 512;

      this.audioContext.createMediaStreamSource(stream).connect(analyser);

      const data        = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart: number | null = null;

      const tick = () => {
        if (!this.recording()) return;

        analyser.getByteTimeDomainData(data);

        // Calculate RMS amplitude (0–100)
        let sum = 0;
        for (const v of data) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        const rms = Math.sqrt(sum / data.length) * 100;

        if (rms < SILENCE_THRESHOLD) {
          if (silenceStart === null) {
            silenceStart = Date.now();
          } else if (Date.now() - silenceStart >= SILENCE_DURATION_MS) {
            // 3 seconds of silence — auto stop
            this.stop();
            return;
          }
        } else {
          silenceStart = null; // reset on any speech
        }

        this.rafHandle = requestAnimationFrame(tick);
      };

      this.rafHandle = requestAnimationFrame(tick);
    } catch (err) {
      console.warn('[voice] silence detection unavailable:', err);
      // Fall back to manual stop — recording still works
    }
  }

  private _teardownSilenceDetection(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
  }

  private _cleanupRecorder(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this._teardownSilenceDetection();
  }

  private _getSupportedMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm';
  }
}
