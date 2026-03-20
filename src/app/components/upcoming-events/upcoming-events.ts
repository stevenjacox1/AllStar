import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EventsService } from '../../services/events.service';

@Component({
  selector: 'app-upcoming-events',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './upcoming-events.html',
  styleUrl: './upcoming-events.css'
})
export class UpcomingEventsComponent {
  private readonly eventsService = inject(EventsService);
  protected readonly events = this.eventsService.events;
}
