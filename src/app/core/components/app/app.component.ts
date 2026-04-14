// src/app/app.component.ts
import {
  Component, OnInit, OnDestroy, inject, signal, computed
} from '@angular/core';
import { Subscription } from 'rxjs';

import { DemoWsService }        from '../../services/demo-ws.service';
import { AudioPlayerService }   from '../../services/audio-player.service';
import { VoiceRecorderService } from '../../services/voice-recorder.service';

import { WorkflowSelectorComponent }               from '../workflow-selector/workflow-selector.component';
import { VideoPlayerComponent, StampedVideoControl } from '../video-player/video-player.component';

import {
  DemoEvent, DemoStatus, VideoControlEvent, WorkflowSummary
} from '../../models/demo-events.models';

const VIDEO_BASE = '/assets/videos';
type VoiceState = 'idle' | 'listening' | 'analyzing' | 'responding';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [WorkflowSelectorComponent, VideoPlayerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  wsService    = inject(DemoWsService);
  audioService = inject(AudioPlayerService);
  voiceService = inject(VoiceRecorderService);

  // ── Signals ────────────────────────────────────────────────────────────
  demoStatus     = signal<DemoStatus>('connecting');
  workflows      = signal<WorkflowSummary[]>([]);
  workflowName   = signal<string>('');
  videoSrc       = signal<string | null>(null);
  segmentIndex   = signal<number>(0);
  segmentTitle   = signal<string>('');
  stampedControl = signal<StampedVideoControl | null>(null);
  voiceState     = signal<VoiceState>('idle');
  agentResponse  = signal<string>('');
  errorMessage   = signal<string | null>(null);
  isPaused       = signal<boolean>(false);

  private _ctrlSeq = 0;

  /**
   * Monotonically incrementing token.
   * Each mic session gets its own token. When _afterResponseComplete fires,
   * it checks whether its token still matches the current one — if not,
   * a new mic session has started and the old resume is cancelled.
   */
  private _responseToken = 0;

  showSelector = computed(() =>
    this.demoStatus() === 'connecting'   ||
    this.demoStatus() === 'disconnected' ||
    this.demoStatus() === 'listing'
  );

  canControl = computed(() =>
    (this.demoStatus() === 'narrating' || this.demoStatus() === 'awaiting') &&
    this.voiceState() === 'idle'
  );

  private sub!:      Subscription;
  private voiceSub!: Subscription;
  private tsTimer:   ReturnType<typeof setTimeout> | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.sub = this.wsService.events$.subscribe(e => this._handle(e));

    this.voiceSub = this.voiceService.audioBlob$.subscribe(blob => {
      this.voiceState.set('analyzing');
      this.wsService.sendVoice(blob);
    });

    this.wsService.connect();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.voiceSub?.unsubscribe();
    this.wsService.disconnect();
  }

  // ── Event handler ──────────────────────────────────────────────────────

  private _handle(event: DemoEvent): void {
    switch (event.type) {

      case 'workflow_list':
        this.workflows.set(event.workflows);
        this.demoStatus.set('listing');
        break;

      case 'segment_start':
        this.demoStatus.set('narrating');
        this.segmentIndex.set(event.index);
        this.segmentTitle.set(event.title);
        this.isPaused.set(false);
        this.voiceState.set('idle');
        this.agentResponse.set('');
        break;

      case 'video_control':
        this._applyControl(event);
        break;

      case 'agent_answer': {
        // Capture token at the time this answer arrives.
        // If user clicks mic again before audio ends, token will have changed
        // and _afterResponseComplete will be a no-op.
        const myToken = ++this._responseToken;

        this.voiceState.set('responding');
        this.agentResponse.set(event.text);

        if (event.audio_b64) {
          this.audioService.playBase64(event.audio_b64).then(() => {
            this._afterResponseComplete(myToken);
          });
        } else {
          setTimeout(() => this._afterResponseComplete(myToken), 3500);
        }
        break;
      }

      case 'awaiting':
        this.voiceState.set('idle');
        break;

      case 'demo_complete':
        this.demoStatus.set('complete');
        this.voiceState.set('idle');
        break;

      case 'error':
        this.voiceState.set('idle');
        this.agentResponse.set('');
        this.errorMessage.set(event.message || 'Something went wrong.');
        setTimeout(() => this.errorMessage.set(null), 5000);
        this._resumeIfWasPlaying();
        break;
    }
  }

  /**
   * Called when TTS finishes (or text timeout).
   * The token check ensures a new mic session invalidates this callback.
   */
  private _afterResponseComplete(token: number): void {
    // Another mic click has happened since this response was generated — abort
    if (token !== this._responseToken) return;

    this.voiceState.set('idle');
    this.agentResponse.set('');
    if (this.demoStatus() !== 'complete') {
      this._applyControl({ type: 'video_control', action: 'play' });
      this.isPaused.set(false);
    }
  }

  private _resumeIfWasPlaying(): void {
    if (
      this.demoStatus() === 'narrating' ||
      this.demoStatus() === 'awaiting'
    ) {
      setTimeout(() => {
        this._applyControl({ type: 'video_control', action: 'play' });
        this.isPaused.set(false);
      }, 1000);
    }
  }

  private _applyControl(event: VideoControlEvent): void {
    this.stampedControl.set({ event, seq: ++this._ctrlSeq });
    if (event.action === 'pause') this.isPaused.set(true);
    if (event.action === 'play')  this.isPaused.set(false);
  }

  // ── User actions ───────────────────────────────────────────────────────

  onWorkflowSelect(workflowId: string): void {
    this.demoStatus.set('loading');
    const wf = this.workflows().find(w => w.workflow_id === workflowId);
    if (wf) {
      this.workflowName.set(wf.name);
      this.videoSrc.set(`${VIDEO_BASE}/${workflowId}.mp4`);
    }
    this.wsService.sendText(workflowId);
  }

  onPausePlayToggle(): void {
    if (this.isPaused()) {
      this._applyControl({ type: 'video_control', action: 'play' });
      this.demoStatus.set('narrating');
    } else {
      this._applyControl({ type: 'video_control', action: 'pause' });
      // FIX: Removed this.wsService.sendText('pause'); to prevent LLM from treating it as a chat prompt
    }
  }

  onRestart(): void {
    const currentWfId = this.workflows().find(w => w.name === this.workflowName())?.workflow_id;

    this.audioService.stop();
    this._responseToken++;
    this.agentResponse.set('');
    this.isPaused.set(false);
    this.demoStatus.set('loading');
    this.voiceState.set('idle');

    // FIX 1: Explicitly rewind the video to the beginning
    this._applyControl({ type: 'video_control', action: 'seek', timestamp: 0 });

    // FIX 2: Generate a fresh WS session to wipe LangGraph thread memory
    this.wsService.reconnectWithNewSession();

    // FIX 3: Resend the workflow selection after a brief delay so the backend starts over
    setTimeout(() => {
      if (currentWfId) {
        this.wsService.sendText(currentWfId);
      }
    }, 500); 
  }

  onEnd(): void {
    this.wsService.sendText('quit');
  }

  async onMicClick(): Promise<void> {
    // Manual stop while already listening
    if (this.voiceState() === 'listening') {
      this.voiceService.stop();
      return;
    }

    if (!this.canControl()) return;

    this.audioService.stop();         // stops TTS immediately
    this._responseToken++;            // invalidates any pending _afterResponseComplete
    this.agentResponse.set('');       // clear response card immediately

    // FIX: Pause video locally only. Removed this.wsService.sendText('pause');
    this._applyControl({ type: 'video_control', action: 'pause' });

    try {
      this.voiceState.set('listening');
      await this.voiceService.start();
    } catch (err) {
      console.error('[mic] failed:', err);
      this.voiceState.set('idle');
      this.errorMessage.set('Microphone access denied — check browser permissions.');
      this._applyControl({ type: 'video_control', action: 'play' });
      this.isPaused.set(false);
    }
  }

  onVideoTimestamp(ts: number): void {
    if (this.tsTimer) return;
    this.tsTimer = setTimeout(() => {
      this.wsService.sendTimestamp(ts);
      this.tsTimer = null;
    }, 1000);
  }

  resetToSelector(): void {
    this.audioService.stop();
    this._responseToken++;
    this.wsService.reconnectWithNewSession();

    this.demoStatus.set('connecting');
    this.workflows.set([]);
    this.workflowName.set('');
    this.videoSrc.set(null);
    this.segmentIndex.set(0);
    this.segmentTitle.set('');
    this.stampedControl.set(null);
    this.voiceState.set('idle');
    this.agentResponse.set('');
    this.isPaused.set(false);
    this._ctrlSeq = 0;
  }
}