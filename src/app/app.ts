import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EventsCalendarComponent } from './components/events-calendar/events-calendar';

@Component({
  selector: 'app-root',
  imports: [EventsCalendarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ASSBar');
}
