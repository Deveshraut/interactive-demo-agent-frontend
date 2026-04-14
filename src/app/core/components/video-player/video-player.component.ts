import {
  Component, ElementRef, input, OnChanges,
  output, SimpleChanges, viewChild
} from '@angular/core';
import { VideoControlEvent } from '../../models/demo-events.models';

/**
 * Stamped wrapper so AppComponent can trigger ngOnChanges even when two
 * consecutive events have the same action (e.g. play → play).
 * AppComponent wraps every video_control in { event, seq: counter++ }.
 */
export interface StampedVideoControl {
  event: VideoControlEvent;
  seq:   number;
}

@Component({
  selector: 'app-video-player',
  standalone: true,
  templateUrl: './video-player.component.html',
  styleUrl: './video-player.component.scss'
})
export class VideoPlayerComponent implements OnChanges {
  videoSrc     = input<string | null>(null);
  controlEvent = input<StampedVideoControl | null>(null);   // ← stamped wrapper
  timestamp$   = output<number>();

  private videoEl    = viewChild.required<ElementRef<HTMLVideoElement>>('videoEl');
  private lastEmitTs = -1;

  ngOnChanges(changes: SimpleChanges): void {
    // seq always increments → fires even for repeated same-action events
    if (changes['controlEvent'] && this.controlEvent()) {
      this._apply(this.controlEvent()!.event);
    }
  }

  onTimeUpdate(): void {
    const t = Math.floor(this.videoEl().nativeElement.currentTime);
    if (t !== this.lastEmitTs) {
      this.lastEmitTs = t;
      this.timestamp$.emit(t);
    }
  }

  private _apply(event: VideoControlEvent): void {
    const el = this.videoEl().nativeElement;
    if (!el) return;

    switch (event.action) {
      case 'seek':
        if (event.timestamp !== undefined) el.currentTime = event.timestamp;
        break;
      case 'play':
        el.play().catch(err => console.warn('[video] play() blocked:', err));
        break;
      case 'pause':
        el.pause();
        break;
    }
  }
}