
import {
  Component, OnInit, OnDestroy, inject, signal
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DemoWsService } from '../../services/demo-ws.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { VoiceRecorderService } from '../../services/voice-recorder.service';
import { WorkflowSelectorComponent } from '../workflow-selector/workflow-selector.component';
import { VideoPlayerComponent } from '../video-player/video-player.component';
import { NarrationPanelComponent } from '../narration-panel/narration-panel.component';
import { DemoControlsComponent } from '../demo-controls/demo-controls.component';
import { ChatPanelComponent, ChatMessage} from '../chat-panel/chat-panel.component';

import {
  DemoEvent, DemoStatus, VideoControlEvent, WorkflowSummary
} from '../../models/demo-events.models';

// ── Path where MP4 files live in Angular's assets ────────────────────────────
const VIDEO_BASE = '/assets/videos';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
     WorkflowSelectorComponent,
     VideoPlayerComponent,
     NarrationPanelComponent,
     ChatPanelComponent,
     DemoControlsComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  wsService    = inject(DemoWsService);
  audioService = inject(AudioPlayerService);
  voiceService = inject(VoiceRecorderService);

  // ── UI state signals ────────────────────────────────────────────────────────
  demoStatus         = signal<DemoStatus>('connecting');
  workflows          = signal<WorkflowSummary[]>([]);
  workflowName       = signal<string>('');
  videoSrc           = signal<string | null>(null);
  segmentIndex       = signal<number>(0);
  segmentTitle       = signal<string>('');
  narrationText      = signal<string>('');
  latestVideoControl = signal<VideoControlEvent | null>(null);
  chatMessages       = signal<ChatMessage[]>([]);
  thinking           = signal<boolean>(false);
  errorMessage       = signal<string | null>(null);

  private sub!: Subscription;
  private voiceSub!: Subscription;
  private tsThrottle: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // ── Subscribe to inbound WS events ───────────────────────────────────────
    this.sub = this.wsService.events$.subscribe(e => this._handleEvent(e));

    // ── Voice blobs → send two-frame voice protocol ───────────────────────────
    this.voiceSub = this.voiceService.audioBlob$.subscribe(blob => {
      this.wsService.sendVoice(blob);
      this.thinking.set(true);
    });

    this.wsService.connect();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.voiceSub?.unsubscribe();
    this.wsService.disconnect();
  }

  // ── Event handler ─────────────────────────────────────────────────────────
  private _handleEvent(event: DemoEvent): void {
    switch (event.type) {

      case 'workflow_list':
        this.workflows.set(event.workflows);
        this.demoStatus.set('listing');
        break;

      case 'segment_start':
        this.demoStatus.set('narrating');
        this.segmentIndex.set(event.index);
        this.segmentTitle.set(event.title);
        this.narrationText.set(event.narration_text);
        this.thinking.set(false);
        break;

      case 'video_control':
        this.latestVideoControl.set({ ...event });
        break;

      case 'agent_answer':
        this.thinking.set(false);
        this.demoStatus.set('awaiting');
        this._addMessage('agent', event.text);
        if (event.audio_b64) {
          this.audioService.playBase64(event.audio_b64);
        }
        break;

      case 'awaiting':
        this.thinking.set(false);
        this.demoStatus.set('awaiting');
        break;

      case 'demo_complete':
        this.demoStatus.set('complete');
        this.thinking.set(false);
        break;

      case 'error':
        this.thinking.set(false);
        this.errorMessage.set(event.message);
        setTimeout(() => this.errorMessage.set(null), 5000);
        break;
    }
  }

  // ── User actions ──────────────────────────────────────────────────────────
  onWorkflowSelect(workflowId: string): void {
    this.demoStatus.set('loading');
    const wf = this.workflows().find(w => w.workflow_id === workflowId);
    if (wf) {
      this.workflowName.set(wf.name);
      this.videoSrc.set(`${VIDEO_BASE}/${workflowId}.mp4`);
    }
    this.wsService.sendText(workflowId);
  }

  onUserText(text: string): void {
    //this._addMessage('user', text);
    this.thinking.set(true);
    this.wsService.sendText(text);
  }

  sendCommand(cmd: string): void {
    this.wsService.sendText(cmd);
    if (cmd === 'next') this.thinking.set(true);
  }

  async onVoiceToggle(): Promise<void> {
    try {
      await this.voiceService.toggle();
    } catch {
      this.errorMessage.set('Microphone access denied.');
    }
  }

  // Throttle timestamp updates to once per second max
  onVideoTimestamp(ts: number): void {
    if (this.tsThrottle) return;
    this.tsThrottle = setTimeout(() => {
      this.wsService.sendTimestamp(ts);
      this.tsThrottle = null;
    }, 1000);
  }

  resetToSelector(): void {
    this.demoStatus.set('listing');
    this.workflowName.set('');
    this.videoSrc.set(null);
    this.segmentIndex.set(0);
    this.segmentTitle.set('');
    this.narrationText.set('');
    this.chatMessages.set([]);
    this.thinking.set(false);
  }

  private _addMessage(role: 'user' | 'agent', text: string): void {
    this.chatMessages.update(msgs => [
      ...msgs,
      { role, text, timestamp: new Date() }
    ]);
  }
}
