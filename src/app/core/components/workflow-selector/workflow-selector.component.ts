import { Component, input, output } from '@angular/core';
import { WorkflowSummary } from '../../models/demo-events.models'; 

@Component({
  selector: 'app-workflow-selector',
  standalone: true,
  templateUrl: './workflow-selector.component.html',
  styleUrl: './workflow-selector.component.scss'
})
export class WorkflowSelectorComponent {
  workflows = input.required<WorkflowSummary[]>();
  select    = output<string>();
}