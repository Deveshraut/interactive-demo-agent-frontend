import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  private currentAudio: HTMLAudioElement | null = null;

  async playBase64(base64: string): Promise<void> {
    this.stop();

    try {
      const dataUrl = `data:audio/mpeg;base64,${base64}`;
      const audio = new Audio(dataUrl);
      this.currentAudio = audio;

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = (e) => reject(e);
        audio.play().catch(reject);
      });
    } catch (err) {
      console.error('[audio] playback failed:', err);
    } finally {
      this.currentAudio = null;
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
  }

  get isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }
}