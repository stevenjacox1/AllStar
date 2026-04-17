import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

interface GalleryItem {
  key: string;
  day: string | null;
  isDaySection: boolean;
  isSlideshow?: boolean;
  sortOrder: number;
  html: string;
  caption: string;
  imageUrl: string;
}

const SLIDESHOW_PREFIX = 'slideshow:';
const DEFAULT_SLIDE_HTML = '<p>Homepage slideshow image.</p>';
const IMAGE_UPLOAD_TIMEOUT_MS = 20000;

@Component({
  selector: 'app-slideshow-manager',
  imports: [],
  templateUrl: './slideshow-manager.html',
  styleUrl: './slideshow-manager.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SlideshowManagerComponent {
  private readonly http = inject(HttpClient);

  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  protected readonly savingOrder = signal(false);
  protected readonly seedingDemoSlides = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly draggingKey = signal<string | null>(null);

  private readonly allItems = signal<GalleryItem[]>([]);

  protected readonly slideshowItems = computed(() =>
    this.allItems()
      .filter(item => item.key.startsWith(SLIDESHOW_PREFIX))
      .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
  );

  constructor() {
    this.loadSlides();
  }

  protected async uploadSlides(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    if (files.length === 0) {
      return;
    }

    this.uploading.set(true);
    this.error.set('');
    this.success.set('');

    try {
      let nextSortOrder = this.nextSortOrder();

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];

        if (!file.type.startsWith('image/')) {
          throw new Error(`File \"${file.name}\" is not an image.`);
        }

        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`File \"${file.name}\" must be 5MB or smaller.`);
        }

        const slideKey = `${SLIDESHOW_PREFIX}${Date.now()}-${i}-${this.toSlug(file.name)}`;
        const imageDataUrl = await this.readFileAsDataUrl(file);

        const uploadResult = await firstValueFrom(
          this.http
            .post<{ imageUrl: string }>('/api/gallery-image', {
              sectionKey: slideKey,
              imageDataUrl
            })
            .pipe(timeout(IMAGE_UPLOAD_TIMEOUT_MS))
        );

        const uploadedImageUrl = (uploadResult.imageUrl || '').trim();
        if (!uploadedImageUrl) {
          throw new Error(`Upload did not return a URL for \"${file.name}\".`);
        }

        await firstValueFrom(
          this.http.post<GalleryItem>('/api/gallery', {
            key: slideKey,
            html: DEFAULT_SLIDE_HTML,
            caption: this.buildCaptionFromFileName(file.name),
            imageUrl: uploadedImageUrl,
            sortOrder: nextSortOrder
          })
        );

        nextSortOrder += 1;
      }

      this.success.set(files.length === 1 ? 'Slide uploaded.' : `${files.length} slides uploaded.`);
      await this.loadSlides();
    } catch (error) {
      console.error('Failed to upload slideshow images', error);
      this.error.set('Failed to upload one or more slideshow images.');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  protected onDragStart(key: string): void {
    this.draggingKey.set(key);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected async onDrop(targetKey: string): Promise<void> {
    const sourceKey = this.draggingKey();
    this.draggingKey.set(null);

    if (!sourceKey || sourceKey === targetKey) {
      return;
    }

    const orderedSlides = [...this.slideshowItems()];
    const fromIndex = orderedSlides.findIndex(item => item.key === sourceKey);
    const toIndex = orderedSlides.findIndex(item => item.key === targetKey);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const [moved] = orderedSlides.splice(fromIndex, 1);
    orderedSlides.splice(toIndex, 0, moved);

    this.applyLocalOrder(orderedSlides);
    await this.persistSlideOrder(orderedSlides);
  }

  protected onDragEnd(): void {
    this.draggingKey.set(null);
  }

  protected async removeSlide(key: string): Promise<void> {
    const slide = this.slideshowItems().find(item => item.key === key);
    if (!slide) {
      return;
    }

    if (!confirm(`Remove slideshow image \"${slide.caption}\"?`)) {
      return;
    }

    this.error.set('');
    this.success.set('');

    try {
      await firstValueFrom(this.http.delete(`/api/gallery/${encodeURIComponent(key)}`));
      await this.loadSlides();
      this.success.set('Slide removed.');
    } catch (error) {
      console.error('Failed to remove slideshow image', error);
      this.error.set('Failed to remove slideshow image.');
    }
  }

  protected async addDemoSlides(): Promise<void> {
    this.seedingDemoSlides.set(true);
    this.error.set('');
    this.success.set('');

    const captions = [
      'Friends cheering at the bar',
      'Game day high-fives',
      'Crowd enjoying the big screen',
      'Weekend party energy',
      'Fans celebrating together',
      'Cheers and good vibes'
    ];

    try {
      let nextSortOrder = this.nextSortOrder();

      for (let i = 0; i < captions.length; i += 1) {
        const slideKey = `${SLIDESHOW_PREFIX}demo-${Date.now()}-${i}`;
        const imageUrl = `https://source.unsplash.com/1600x900/?sports-bar,friends,party,cheers&sig=${Date.now() + i}`;

        await firstValueFrom(
          this.http.post<GalleryItem>('/api/gallery', {
            key: slideKey,
            html: DEFAULT_SLIDE_HTML,
            caption: captions[i],
            imageUrl,
            sortOrder: nextSortOrder
          })
        );

        nextSortOrder += 1;
      }

      await this.loadSlides();
      this.success.set('Demo slides added.');
    } catch (error) {
      console.error('Failed to add demo slideshow images', error);
      this.error.set('Failed to add demo slideshow images.');
    } finally {
      this.seedingDemoSlides.set(false);
    }
  }

  private async persistSlideOrder(orderedSlides: GalleryItem[]): Promise<void> {
    this.savingOrder.set(true);
    this.error.set('');
    this.success.set('');

    try {
      for (let i = 0; i < orderedSlides.length; i += 1) {
        const item = orderedSlides[i];
        await firstValueFrom(
          this.http.post<GalleryItem>('/api/gallery', {
            key: item.key,
            html: item.html?.trim() || DEFAULT_SLIDE_HTML,
            caption: item.caption?.trim() || 'Slideshow image',
            imageUrl: item.imageUrl?.trim() || '',
            sortOrder: 10000 + i
          })
        );
      }

      this.success.set('Slideshow order saved.');
      await this.loadSlides();
    } catch (error) {
      console.error('Failed to save slideshow order', error);
      this.error.set('Failed to save slideshow order.');
      await this.loadSlides();
    } finally {
      this.savingOrder.set(false);
    }
  }

  private applyLocalOrder(orderedSlides: GalleryItem[]): void {
    const nextSortOrderByKey = new Map(
      orderedSlides.map((item, index) => [item.key, 10000 + index])
    );

    this.allItems.update(items =>
      items.map(item => {
        const updatedSortOrder = nextSortOrderByKey.get(item.key);
        return updatedSortOrder == null ? item : { ...item, sortOrder: updatedSortOrder };
      })
    );
  }

  private async loadSlides(): Promise<void> {
    this.loading.set(true);

    try {
      const items = await firstValueFrom(this.http.get<GalleryItem[]>('/api/gallery'));
      this.allItems.set(items ?? []);
    } catch (error) {
      console.error('Failed to load slideshow items', error);
      this.error.set('Failed to load slideshow items.');
      this.allItems.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private nextSortOrder(): number {
    const maxSortOrder = this.slideshowItems().reduce((maxValue, item) => {
      const sortOrder = Number.isFinite(Number(item.sortOrder))
        ? Number(item.sortOrder)
        : 10000;
      return Math.max(maxValue, sortOrder);
    }, 9999);

    return maxSortOrder + 1;
  }

  private buildCaptionFromFileName(fileName: string): string {
    return fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Slideshow image';
  }

  private toSlug(value: string): string {
    return value
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'slide';
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && reader.result) {
          resolve(reader.result);
          return;
        }

        reject(new Error('Failed to convert file to data URL.'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }
}
