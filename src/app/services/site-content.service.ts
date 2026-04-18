import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const HERO_TEXT_DEFAULT = 'The BEST Sports Bar South of Seattle! In the beautiful city of Des Moines!!!';

@Injectable({ providedIn: 'root' })
export class SiteContentService {
  private readonly http = inject(HttpClient);

  private readonly _heroText = signal<string>(HERO_TEXT_DEFAULT);
  readonly heroText = this._heroText.asReadonly();

  loadHeroText(): void {
    this.http.get<{ key: string; value: string }>('/api/site-content/heroText').subscribe({
      next: res => this._heroText.set(res.value || HERO_TEXT_DEFAULT),
      error: () => { /* keep default */ }
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
