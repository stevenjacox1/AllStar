import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DailySpecialsGalleryComponent } from '../components/daily-specials-gallery/daily-specials-gallery.component';
import { UpcomingEventsComponent } from '../components/upcoming-events/upcoming-events';

interface GalleryItem {
  key: string;
  caption: string;
  imageUrl: string;
  sortOrder: number;
}

interface VibeSlide {
  key: string;
  title: string;
  imageUrl: string;
}

const SLIDE_ROTATION_MS = 5000;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DailySpecialsGalleryComponent, UpcomingEventsComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private rotationTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly vibeSlides = signal<VibeSlide[]>([]);
  protected readonly activeVibeSlideIndex = signal(0);

  protected readonly activeVibeSlide = computed(() => {
    const slides = this.vibeSlides();
    if (slides.length === 0) {
      return null;
    }

    return slides[this.activeVibeSlideIndex()] ?? slides[0];
  });

  constructor() {
    this.loadVibeSlides();
    this.destroyRef.onDestroy(() => this.stopRotation());
  }

  protected setActiveSlide(index: number): void {
    const totalSlides = this.vibeSlides().length;
    if (totalSlides === 0) {
      return;
    }

    this.activeVibeSlideIndex.set(((index % totalSlides) + totalSlides) % totalSlides);
  }

  private loadVibeSlides(): void {
    this.http.get<GalleryItem[]>('/api/gallery').subscribe({
      next: (items) => {
        const slides = (items ?? [])
          .filter(item => typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0)
          .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
          .map(item => ({
            key: item.key,
            title: item.caption?.trim() || 'All-Star Vibe',
            imageUrl: item.imageUrl.trim()
          }));

        this.vibeSlides.set(slides);
        this.activeVibeSlideIndex.set(0);
        this.startRotation();
      },
      error: (error) => {
        console.error('Failed to load vibe slideshow images', error);
        this.vibeSlides.set([]);
        this.stopRotation();
      }
    });
  }

  private startRotation(): void {
    this.stopRotation();

    if (this.vibeSlides().length < 2) {
      return;
    }

    this.rotationTimer = setInterval(() => {
      this.activeVibeSlideIndex.update((index) => {
        const count = this.vibeSlides().length;
        if (count < 2) {
          return 0;
        }

        return (index + 1) % count;
      });
    }, SLIDE_ROTATION_MS);
  }

  private stopRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }
}
