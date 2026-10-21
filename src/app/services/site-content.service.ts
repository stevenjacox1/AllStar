import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class SiteContentService {
  private readonly http = inject(HttpClient);

  private readonly _heroText = signal<string>('');
  readonly heroText = this._heroText.asReadonly();

  loadHeroText(): Promise<void> {
    return new Promise(resolve => {
      this.http.get<{ key: string; value: string }>('/api/site-content/heroText').subscribe({
        next: res => {
          this._heroText.set(res?.value ?? '');
          resolve();
        },
        error: () => resolve()
      });
    });
  }

  saveHeroText(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.post<{ key: string; value: string }>('/api/site-content/heroText', { value: text }).subscribe({
        next: res => {
          this._heroText.set(res.value);
          resolve();
        },
        error: reject
      });
    });
  }
}
