// src/app/components/chat-panel/chat-panel.component.ts
import { Component, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoStatus } from '../../models/demo-events.models';

export interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss'
})
export class ChatPanelComponent {
  demoStatus  = input<DemoStatus>('disconnected');
  isRecording = input<boolean>(false);
  messages    = input<ChatMessage[]>([]);
  thinking    = input<boolean>(false);

  sendText    = output<string>();
  voiceToggle = output<void>();

  inputText = '';

  isActive = computed(() =>
    this.demoStatus() === 'narrating' || this.demoStatus() === 'awaiting'
  );

  canInput = computed(() =>
    this.demoStatus() === 'narrating' || this.demoStatus() === 'awaiting'
  );

  submitText(): void {
    const text = this.inputText.trim();
    if (!text || !this.canInput()) return;
    this.sendText.emit(text);
    this.inputText = '';
  }
}
