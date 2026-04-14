import { Injectable } from '@angular/core';

export type PlaybackResult = 'ended' | 'stopped' | 'error';

@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  private currentAudio: HTMLAudioElement | null = null;
  private settleCurrent: ((result: PlaybackResult) => void) | null = null;

  async playBase64(base64: string): Promise<PlaybackResult> {
    this.stop();

    try {
      const dataUrl = `data:audio/mpeg;base64,${base64}`;
      const audio = new Audio(dataUrl);
      audio.preload = 'auto';
      this.currentAudio = audio;

      return await new Promise<PlaybackResult>((resolve) => {
        let settled = false;

        const finalize = (result: PlaybackResult) => {
          if (settled) return;
          settled = true;

          audio.onended = null;
          audio.onerror = null;

          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          if (this.settleCurrent === finalize) {
            this.settleCurrent = null;
          }

          resolve(result);
        };

        this.settleCurrent = finalize;
        audio.onended = () => finalize('ended');
        audio.onerror = () => finalize('error');

        audio.play().catch(err => {
          console.error('[audio] playback failed:', err);
          finalize('error');
        });
      });
    } catch (err) {
      console.error('[audio] playback failed:', err);
      this.currentAudio = null;
      this.settleCurrent = null;
      return 'error';
    }
  }

  stop(): void {
    const settle = this.settleCurrent;
    this.settleCurrent = null;

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.currentTime = 0;
      
      // FIX: Cleanly remove the source instead of setting it to an empty string and reloading
      this.currentAudio.removeAttribute('src'); 
      this.currentAudio = null;
    }

    settle?.('stopped');
  }

  get isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }
}
