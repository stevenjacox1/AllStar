import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal
} from '@angular/core';
import { UpcomingEventsComponent } from '../components/upcoming-events/upcoming-events';

interface GallerySlide {
  day: string;
  src: string;
  alt: string;
  caption: string;
  details: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgOptimizedImage, UpcomingEventsComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  protected readonly slides: readonly GallerySlide[] = [
    {
      day: 'Monday',
      src: '/gallery/monday.jpg',
      alt: 'Monday crowd enjoying game night at All-Star Sports Bar',
      caption: 'Monday Kickoff',
      details: 'Start the week strong with Monday Night Football, half-price appetizers from 6-8 PM, and our house lager pint special.'
    },
    {
      day: 'Tuesday',
      src: '/gallery/tuesday.png',
      alt: 'Taco Tuesday and specials at All-Star Sports Bar',
      caption: 'Taco Tuesday',
      details: '2 Chicken or Beef Tacos for $5.'
    },
    {
      day: 'Wednesday',
      src: '/gallery/wednesday.jpg',
      alt: 'Wednesday sports trivia and packed tables',
      caption: 'Wednesday Trivia',
      details: 'Sports trivia night starts at 7 PM with team prizes, wing platters, and rotating craft drafts on tap.'
    },
    {
      day: 'Thursday',
      src: '/gallery/thursday.jpg',
      alt: 'Thursday rivalry game atmosphere in the bar',
      caption: 'Thursday Rivalry',
      details: 'Prime-time rivalry games on every screen, loaded nacho specials, and reserved front-row seating for early arrivals.'
    },
    {
      day: 'Friday',
      src: '/gallery/friday.jpg',
      alt: 'Friday night lights watch party at All-Star',
      caption: 'Friday Prime Time',
      details: 'Friday watch parties with DJ breaks between games, signature cocktails, and fan jersey giveaways after 9 PM.'
    },
    {
      day: 'Saturday',
      src: '/gallery/saturday.jpg',
      alt: 'Saturday college football fans cheering together',
      caption: 'Saturday Showdown',
      details: 'All-day college football coverage, breakfast-to-brunch game menu, and pitcher bundles for group tables.'
    },
    {
      day: 'Sunday',
      src: '/gallery/sunday.jpg',
      alt: 'Sunday full house for all-day game coverage',
      caption: 'Sunday All-Day Action',
      details: 'Sunday ticket wall-to-wall action, game-day combo platters, and happy hour pricing from kickoff through halftime.'
    }
  ];

  protected readonly activeIndex = signal(this.getStartingSlideIndex());
  protected readonly activeSlide = computed(() => this.slides[this.activeIndex()]);

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
