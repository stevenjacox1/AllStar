import { HttpClient } from '@angular/common/http';
import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { marked } from 'marked';
import { catchError, map, of, switchMap } from 'rxjs';

interface GallerySlide {
  day: string;
  dayKey: string;
  src: string;
  alt: string;
  caption: string;
}

@Component({
  selector: 'app-daily-specials-gallery',
  imports: [NgOptimizedImage],
  templateUrl: './daily-specials-gallery.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DailySpecialsGalleryComponent {
  private readonly http = inject(HttpClient);

  protected readonly slides: readonly GallerySlide[] = [
    {
      day: 'Monday',
      dayKey: 'monday',
      src: '/gallery/monday.jpg',
      alt: 'Monday crowd enjoying game night at All-Star Sports Bar',
      caption: 'Miller Monday'
    },
    {
      day: 'Tuesday',
      dayKey: 'tuesday',
      src: '/gallery/tuesday.png',
      alt: 'Taco Tuesday',
      caption: 'Taco Tuesday'
    },
    {
      day: 'Wednesday',
      dayKey: 'wednesday',
      src: '/gallery/wednesday.jpg',
      alt: 'Hornitos Humpday',
      caption: 'Hornitos Humpday'
    },
    {
      day: 'Thursday',
      dayKey: 'thursday',
      src: '/gallery/thursday.jpg',
      alt: 'Crown Royal Thursday',
      caption: 'Crown Royal Thursday'
    },
    {
      day: 'Friday',
      dayKey: 'friday',
      src: '/gallery/friday.jpg',
      alt: 'Friday night lights watch party at All-Star',
      caption: 'Fireball Friday'
    },
    {
      day: 'Saturday',
      dayKey: 'saturday',
      src: '/gallery/saturday.jpg',
      alt: 'Svedka Saturday',
      caption: 'Svedka Saturday'
    },
    {
      day: 'Sunday',
      dayKey: 'sunday',
      src: '/gallery/sunday.jpg',
      alt: 'Sunday full house for all-day game coverage',
      caption: 'Sunday All-Day Action'
    }
  ];

  protected readonly activeIndex = signal(this.getStartingSlideIndex());
  protected readonly activeSlide = computed(() => this.slides[this.activeIndex()]);
  protected readonly activeDetailsHtml = toSignal(
    toObservable(this.activeSlide).pipe(
      switchMap(slide =>
        this.http.get<{ markdown: string } | null>(`/api/gallery/${slide.dayKey}`).pipe(
          map(response => marked.parse(response?.markdown ?? '') as string),
          catchError(() => of('<p>Special details are unavailable right now.</p>'))
        )
      )
    ),
    { initialValue: '<p>Loading details...</p>' }
  );

  protected nextSlide(): void {
    this.activeIndex.update(i => (i + 1) % this.slides.length);
  }

  protected previousSlide(): void {
    this.activeIndex.update(i => (i - 1 + this.slides.length) % this.slides.length);
  }

  protected jumpToSlide(index: number): void {
    this.activeIndex.set(index);
  }

  private getStartingSlideIndex(): number {
    const dayOfWeek = new Date().getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }
}
