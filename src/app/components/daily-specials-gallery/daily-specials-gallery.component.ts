import { HttpClient } from '@angular/common/http';
import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';

interface GallerySlide {
  day: string;
  dayKey: string;
  src: string;
  alt: string;
  defaultCaption: string;
}

interface GalleryContent {
  html: string;
  caption: string;
}

function normalizeHtml(html: string): string {
  return html.replace(/font-color\s*:/gi, 'color:');
}

@Component({
  selector: 'app-daily-specials-gallery',
  imports: [NgOptimizedImage],
  templateUrl: './daily-specials-gallery.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DailySpecialsGalleryComponent {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly slides: readonly GallerySlide[] = [
    {
      day: 'Monday',
      dayKey: 'monday',
      src: '/gallery/monday.jpg',
      alt: 'Monday crowd enjoying game night at All-Star Sports Bar',
      defaultCaption: 'Miller Monday'
    },
    {
      day: 'Tuesday',
      dayKey: 'tuesday',
      src: '/gallery/tuesday.png',
      alt: 'Taco Tuesday',
      defaultCaption: 'Taco Tuesday'
    },
    {
      day: 'Wednesday',
      dayKey: 'wednesday',
      src: '/gallery/wednesday.jpg',
      alt: 'Hornitos Humpday',
      defaultCaption: 'Hornitos Humpday'
    },
    {
      day: 'Thursday',
      dayKey: 'thursday',
      src: '/gallery/thursday.jpg',
      alt: 'Crown Royal Thursday',
      defaultCaption: 'Crown Royal Thursday'
    },
    {
      day: 'Friday',
      dayKey: 'friday',
      src: '/gallery/friday.jpg',
      alt: 'Friday night lights watch party at All-Star',
      defaultCaption: 'Fireball Friday'
    },
    {
      day: 'Saturday',
      dayKey: 'saturday',
      src: '/gallery/saturday.jpg',
      alt: 'Svedka Saturday',
      defaultCaption: 'Svedka Saturday'
    },
    {
      day: 'Sunday',
      dayKey: 'sunday',
      src: '/gallery/sunday.jpg',
      alt: 'Sunday full house for all-day game coverage',
      defaultCaption: 'Sunday All-Day Action'
    }
  ];

  protected readonly activeIndex = signal(this.getStartingSlideIndex());
  protected readonly activeSlide = computed(() => this.slides[this.activeIndex()]);
  private readonly activeContent = toSignal(
    toObservable(this.activeSlide).pipe(
      switchMap(slide =>
        this.http.get<{ html: string; caption: string } | null>(`/api/gallery/${slide.dayKey}`).pipe(
          map(response => ({
            html: normalizeHtml(response?.html ?? ''),
            caption: response?.caption?.trim() ?? ''
          })),
          catchError(() => of({ html: '<p>Special details are unavailable right now.</p>', caption: '' }))
        )
      )
    ),
    { initialValue: { html: '<p>Loading details...</p>', caption: '' } }
  );
  protected readonly activeCaption = computed(() =>
    (this.activeContent()?.caption || '').trim() || this.activeSlide().defaultCaption
  );
  protected readonly activeDetailsHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.activeContent()?.html ?? '<p>Loading details...</p>')
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
