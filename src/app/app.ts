import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { EventsCalendarComponent } from './components/events-calendar/events-calendar';

interface GallerySlide {
  day: string;
  src: string;
  alt: string;
  caption: string;
}

@Component({
  selector: 'app-root',
  imports: [EventsCalendarComponent, NgOptimizedImage],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly title = signal('ASSBar');
  protected readonly slides: readonly GallerySlide[] = [
    {
      day: 'Monday',
      src: '/gallery/monday.jpg',
      alt: 'Monday crowd enjoying game night at All-Star Sports Bar',
      caption: 'Monday Kickoff'
    },
    {
      day: 'Tuesday',
      src: '/gallery/tuesday.jpg',
      alt: 'Tuesday wing special and big-screen sports viewing',
      caption: 'Tuesday Wing Night'
    },
    {
      day: 'Wednesday',
      src: '/gallery/wednesday.jpg',
      alt: 'Wednesday sports trivia and packed tables',
      caption: 'Wednesday Trivia'
    },
    {
      day: 'Thursday',
      src: '/gallery/thursday.jpg',
      alt: 'Thursday rivalry game atmosphere in the bar',
      caption: 'Thursday Rivalry'
    },
    {
      day: 'Friday',
      src: '/gallery/friday.jpg',
      alt: 'Friday night lights watch party at All-Star',
      caption: 'Friday Prime Time'
    },
    {
      day: 'Saturday',
      src: '/gallery/saturday.jpg',
      alt: 'Saturday college football fans cheering together',
      caption: 'Saturday Showdown'
    },
    {
      day: 'Sunday',
      src: '/gallery/sunday.jpg',
      alt: 'Sunday full house for all-day game coverage',
      caption: 'Sunday All-Day Action'
    }
  ];

  protected readonly activeIndex = signal(this.getStartingSlideIndex());
  protected readonly activeSlide = computed(() => this.slides[this.activeIndex()]);

  constructor() {
    const timer = setInterval(() => {
      this.nextSlide();
    }, 6000);

    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
    });
  }

  protected nextSlide(): void {
    this.activeIndex.update((index) => (index + 1) % this.slides.length);
  }

  protected previousSlide(): void {
    this.activeIndex.update((index) =>
      (index - 1 + this.slides.length) % this.slides.length
    );
  }

  protected jumpToSlide(index: number): void {
    this.activeIndex.set(index);
  }

  private getStartingSlideIndex(): number {
    const dayOfWeek = new Date().getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }
}
