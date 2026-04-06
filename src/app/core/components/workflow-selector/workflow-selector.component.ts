// src/app/components/workflow-selector/workflow-selector.component.ts
import { Component, input, output } from '@angular/core';
import { WorkflowSummary } from '../../models/demo-events.models'; 

@Component({
  selector: 'app-workflow-selector',
  standalone: true,
  templateUrl: './WorkflowSelectorComponent.component.html',
  styleUrl: './WorkflowSelectorComponent.component.scss'
})
export class WorkflowSelectorComponent {
  workflows = input.required<WorkflowSummary[]>();
  select    = output<string>();
}