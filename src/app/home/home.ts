import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { DailySpecialsGalleryComponent } from '../components/daily-specials-gallery/daily-specials-gallery.component';
import { UpcomingEventsComponent } from '../components/upcoming-events/upcoming-events';
import { SiteContentService } from '../services/site-content.service';

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

export interface MenuItem {
  id: string;
  name: string;
  price: string;
  description: string;
}

export interface MenuSection {
  id: string;
  title: string;
  type: 'items' | 'grid' | 'tags';
  note: string | null;
  /** Last date (YYYY-MM-DD, Pacific) the section is shown. */
  hideAfter?: string | null;
  items: MenuItem[];
}

export interface MenuData {
  sections: MenuSection[];
}

const BREAKFAST_SECTION_ID = 'breakfast';
// Default end of football season: Super Bowl LXI
const DEFAULT_BREAKFAST_END = '2027-02-14';

function pacificToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function isSectionExpired(section: MenuSection, now: Date): boolean {
  const end = section.hideAfter ?? (section.id === BREAKFAST_SECTION_ID ? DEFAULT_BREAKFAST_END : null);
  return !!end && pacificToday(now) > end;
}

const SLIDESHOW_PREFIX = 'slideshow:';
const SLIDE_ROTATION_MS = 5000;
const HAPPY_HOUR_SECTION_ID = 'happy-hour';

/**
 * Happy hour runs Sunday–Thursday, 3PM–6PM.
 * Evaluated in the bar's timezone (Des Moines, WA) so the
 * ordering is correct for visitors in any timezone.
 */
function isHappyHour(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    hour: 'numeric',
    hour12: false
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? NaN);
  const weekdayOk = weekday !== 'Fri' && weekday !== 'Sat';
  return weekdayOk && hour >= 15 && hour < 18;
}

/** Breakfast is served Sundays 9AM–1PM Pacific. */
function isSundayBreakfast(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    hour: 'numeric',
    hour12: false
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? NaN);
  return weekday === 'Sun' && hour >= 9 && hour < 13;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgTemplateOutlet, DailySpecialsGalleryComponent, UpcomingEventsComponent],
  host: { '(document:keydown.escape)': 'closeOverlays()' },
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly siteContent = inject(SiteContentService);
  private rotationTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly heroText = this.siteContent.heroText;
  protected readonly orderingEnabled = this.siteContent.onlineOrderingEnabled;
  protected readonly orderingUrl = this.siteContent.onlineOrderingUrl;

  protected readonly menuOpen = signal(false);
  protected readonly findUsModalOpen = signal(false);
  protected readonly mobileNavOpen = signal(false);
  protected readonly menuData = signal<MenuData | null>(null);

  /**
   * Menu sections in display order: the happy-hour section is hoisted
   * to the top while happy hour is active (Sun–Thu, 3–6 PM Pacific).
   */
  protected readonly orderedMenuSections = computed(() => {
    const now = new Date();
    const sections = (this.menuData()?.sections ?? []).filter(s => !isSectionExpired(s, now));
    const hoistId = isHappyHour(now)
      ? HAPPY_HOUR_SECTION_ID
      : isSundayBreakfast(now)
        ? BREAKFAST_SECTION_ID
        : null;
    if (!hoistId) {
      return sections;
    }
    const idx = sections.findIndex(s => s.id === hoistId);
    if (idx <= 0) {
      return sections;
    }
    return [sections[idx], ...sections.slice(0, idx), ...sections.slice(idx + 1)];
  });

  protected openMenu(): void {
    this.menuOpen.set(true);
    this.findUsModalOpen.set(false);
    this.mobileNavOpen.set(false);
    if (!this.menuData()) {
      this.loadMenuData();
    }
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected openFindUsModal(): void {
    this.findUsModalOpen.set(true);
    this.menuOpen.set(false);
    this.mobileNavOpen.set(false);
  }

  protected closeFindUsModal(): void {
    this.findUsModalOpen.set(false);
  }

  protected closeOverlays(): void {
    this.closeMenu();
    this.closeFindUsModal();
  }

  protected toggleMobileNav(): void {
    this.mobileNavOpen.update(v => !v);
  }

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
    this.siteContent.loadHeroText();
    this.siteContent.loadOnlineOrdering();
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
          .filter(item => item.key.startsWith(SLIDESHOW_PREFIX))
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

  private loadMenuData(): void {
    this.http.get<MenuData>('/api/menu').subscribe({
      next: data => this.menuData.set(data),
      error: () => { /* keep null, template shows fallback */ }
    });
  }
}
