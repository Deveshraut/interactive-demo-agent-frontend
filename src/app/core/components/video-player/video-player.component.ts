import {
  Component, ElementRef, input, OnChanges,
  output, SimpleChanges, viewChild
} from '@angular/core';
import { VideoControlEvent } from '../../models/demo-events.models';

@Component({
  selector: 'app-video-player',
  standalone: true,
  templateUrl: './video-player.component.html',
  styleUrl: './video-player.component.scss'
})
export class VideoPlayerComponent implements OnChanges {
  videoSrc    = input<string | null>(null);
  controlEvent = input<VideoControlEvent | null>(null);
  timestamp$  = output<number>();

  private videoEl = viewChild.required<ElementRef<HTMLVideoElement>>('videoEl');

  private lastEmittedTs = -1;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['controlEvent'] && this.controlEvent()) {
      this._applyControl(this.controlEvent()!);
    }
  }

  onTimeUpdate(): void {
    const t = Math.floor(this.videoEl().nativeElement.currentTime);
    if (t !== this.lastEmittedTs) {
      this.lastEmittedTs = t;
      this.timestamp$.emit(t);
    }
  }

  private _applyControl(event: VideoControlEvent): void {
    const el = this.videoEl().nativeElement;
    if (!el) return;

    switch (event.action) {
      case 'seek':
        if (event.timestamp !== undefined) {
          el.currentTime = event.timestamp;
        }
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