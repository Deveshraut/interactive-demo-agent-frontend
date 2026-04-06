// src/app/components/narration-panel/narration-panel.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-narration-panel',
  standalone: true,
  templateUrl: './narration-panel.component.html',
  styleUrl: './narration-panel.component.scss'
})
export class NarrationPanelComponent {
  segmentIndex = input<number>(0);
  segmentTitle = input<string>('');
  narrationText = input<string>('');
}
