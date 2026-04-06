// src/app/app.config.ts
import { ApplicationConfig, provideExperimentalZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    // We are running 100% zoneless!
    provideExperimentalZonelessChangeDetection(), 
  ]
};