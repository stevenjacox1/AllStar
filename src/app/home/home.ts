import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DailySpecialsGalleryComponent } from '../components/daily-specials-gallery/daily-specials-gallery.component';
import { UpcomingEventsComponent } from '../components/upcoming-events/upcoming-events';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DailySpecialsGalleryComponent, UpcomingEventsComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {}
