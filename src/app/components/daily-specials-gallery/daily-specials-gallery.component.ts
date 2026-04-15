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
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

interface GallerySlide {
  day: string;
  dayKey: string;
  src: string;
  alt: string;
  defaultCaption: string;
}

interface GalleryContent {
  key: string;
  day: string | null;
  isDaySection: boolean;
  sortOrder: number;
  html: string;
  caption: string;
}

interface DaySpecial {
  day: string;
  dayKey: string;
  src: string;
  alt: string;
  caption: string;
  detailsHtml: SafeHtml;
}

interface ExtraSpecial {
  key: string;
  caption: string;
  detailsHtml: SafeHtml;
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

  private readonly dayKeys = this.slides.map(slide => slide.dayKey);
  private readonly todayDayKey = signal(this.getTodayDayKey());

  private readonly galleryContent = toSignal(
    this.http.get<GalleryContent[] | null>('/api/gallery').pipe(
      map(response =>
        (response ?? []).map(item => ({
          ...item,
          html: normalizeHtml(item.html ?? ''),
          caption: (item.caption ?? '').trim()
        }))
      ),
      catchError(() => of([]))
    ),
    { initialValue: [] }
  );

  private readonly dayContentByKey = computed(() => {
    const lookup = new Map<string, GalleryContent>();
    for (const item of this.galleryContent()) {
      if (!item.isDaySection || !item.day) {
        continue;
      }
      lookup.set(item.day.toLowerCase(), item);
    }
    return lookup;
  });

  private readonly orderedDayKeys = computed(() => {
    const keys = [...this.dayKeys];
    const today = this.todayDayKey();
    const startIndex = keys.indexOf(today);

    if (startIndex <= 0) {
      return keys;
    }

    return [...keys.slice(startIndex), ...keys.slice(0, startIndex)];
  });

  protected readonly daySpecials = computed<DaySpecial[]>(() =>
    this.orderedDayKeys().map(dayKey => {
      const slide = this.slides.find(item => item.dayKey === dayKey)!;
      const savedContent = this.dayContentByKey().get(dayKey);
      const html = savedContent?.html?.trim() || '<p>Special details are unavailable right now.</p>';

      return {
        day: slide.day,
        dayKey,
        src: slide.src,
        alt: slide.alt,
        caption: savedContent?.caption || slide.defaultCaption,
        detailsHtml: this.sanitizer.bypassSecurityTrustHtml(html)
      };
    })
  );

  protected readonly extraSpecials = computed<ExtraSpecial[]>(() =>
    this.galleryContent()
      .filter(item => !item.isDaySection)
      .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
      .map(item => ({
        key: item.key,
        caption: item.caption || 'Additional Special',
        detailsHtml: this.sanitizer.bypassSecurityTrustHtml(
          item.html?.trim() || '<p>Special details are unavailable right now.</p>'
        )
      }))
  );

  private getTodayDayKey(): string {
    const dayOfWeek = new Date().getDay();
    const index = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return this.dayKeys[index] ?? 'monday';
  }
}
