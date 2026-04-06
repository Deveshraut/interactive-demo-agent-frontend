// src/app/components/demo-controls/demo-controls.component.ts
import { Component, input, output, computed } from '@angular/core';
import { DemoStatus } from '../../models/demo-events.models';

@Component({
  selector: 'app-demo-controls',
  standalone: true,
  templateUrl: './demo-controls.component.html',
  styleUrl: './demo-controls.component.scss'
})
export class DemoControlsComponent {
  demoStatus = input<DemoStatus>('disconnected');

  next    = output<void>();
  pause   = output<void>();
  restart = output<void>();
  quit    = output<void>();

  canAdvance = computed(() =>
    this.demoStatus() === 'narrating' || this.demoStatus() === 'awaiting'
  );

  canControl = computed(() =>
    this.demoStatus() === 'narrating' || this.demoStatus() === 'awaiting'
  );
}
