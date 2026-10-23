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

  private readonly _onlineOrderingEnabled = signal(false);
  private readonly _onlineOrderingUrl = signal('');
  readonly onlineOrderingEnabled = this._onlineOrderingEnabled.asReadonly();
  readonly onlineOrderingUrl = this._onlineOrderingUrl.asReadonly();

  private getValue(key: string): Promise<string> {
    return new Promise(resolve => {
      this.http.get<{ key: string; value: string }>(`/api/site-content/${key}`).subscribe({
        next: res => resolve(res?.value ?? ''),
        error: () => resolve('')
      });
    });
  }

  private postValue(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.post(`/api/site-content/${key}`, { value }).subscribe({
        next: () => resolve(),
        error: reject
      });
    });
  }

  async loadOnlineOrdering(): Promise<void> {
    const [enabled, url] = await Promise.all([
      this.getValue('onlineOrderingEnabled'),
      this.getValue('onlineOrderingUrl')
    ]);
    this._onlineOrderingEnabled.set(enabled === 'true');
    this._onlineOrderingUrl.set(url);
  }

  async saveOnlineOrdering(enabled: boolean, url: string): Promise<void> {
    if (url) {
      await this.postValue('onlineOrderingUrl', url);
    }
    await this.postValue('onlineOrderingEnabled', enabled ? 'true' : 'false');
    this._onlineOrderingEnabled.set(enabled);
    if (url) this._onlineOrderingUrl.set(url);
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
