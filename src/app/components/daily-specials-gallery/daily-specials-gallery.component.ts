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
  src: string;
  alt: string;
  caption: string;
  detailsPath: string;
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
      src: '/gallery/monday.jpg',
      alt: 'Monday crowd enjoying game night at All-Star Sports Bar',
      caption: 'Miller Monday',
      detailsPath: '/gallery-details/monday.md'
    },
    {
      day: 'Tuesday',
      src: '/gallery/tuesday.png',
      alt: 'Taco Tuesday',
      caption: 'Taco Tuesday',
      detailsPath: '/gallery-details/tuesday.md'
    },
    {
      day: 'Wednesday',
      src: '/gallery/wednesday.jpg',
      alt: 'Hornitos Humpday',
      caption: 'Hornitos Humpday',
      detailsPath: '/gallery-details/wednesday.md'
    },
    {
      day: 'Thursday',
      src: '/gallery/thursday.jpg',
      alt: 'Crown Royal Thursday',
      caption: 'Crown Royal Thursday',
      detailsPath: '/gallery-details/thursday.md'
    },
    {
      day: 'Friday',
      src: '/gallery/friday.jpg',
      alt: 'Friday night lights watch party at All-Star',
      caption: 'Fireball Friday',
      detailsPath: '/gallery-details/friday.md'
    },
    {
      day: 'Saturday',
      src: '/gallery/saturday.jpg',
      alt: 'Svedka Saturday',
      caption: 'Svedka Saturday',
      detailsPath: '/gallery-details/saturday.md'
    },
    {
      day: 'Sunday',
      src: '/gallery/sunday.jpg',
      alt: 'Sunday full house for all-day game coverage',
      caption: 'Sunday All-Day Action',
      detailsPath: '/gallery-details/sunday.md'
    }
  ];

  protected readonly activeIndex = signal(this.getStartingSlideIndex());
  protected readonly activeSlide = computed(() => this.slides[this.activeIndex()]);
  protected readonly activeDetailsHtml = toSignal(
    toObservable(this.activeSlide).pipe(
      switchMap(slide =>
        this.http.get(slide.detailsPath, { responseType: 'text' }).pipe(
          map(markdown => marked.parse(markdown) as string),
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
