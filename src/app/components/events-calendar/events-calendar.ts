// events-calendar.component.ts
import { Component } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';

import { CalendarOptions } from '@fullcalendar/core';

@Component({
  selector: 'app-events-calendar',
  standalone: true,
  imports: [FullCalendarModule],
  templateUrl: './events-calendar.html',
  styleUrls: ['./events-calendar.css']  // or .scss
})
export class EventsCalendarComponent {
  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    initialView: 'dayGridMonth',  // start with month view
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    editable: true,               // allow drag/drop (optional)
    selectable: true,             // allow selecting to add events (optional)
    events: [                     // sample sports bar events – replace with your data!
      {
        title: 'NFL Sunday: Chiefs vs Ravens',
        start: '2026-03-15T13:00:00',
        end: '2026-03-15T18:00:00',
        extendedProps: { description: '$5 wings & pitchers' }
      },
      {
        title: 'UFC Fight Night Watch Party',
        start: '2026-03-22T19:00:00',
        backgroundColor: '#ef4444',  // red accent
        borderColor: '#b91c1c'
      },
      {
        title: 'March Madness Bracket Challenge',
        start: '2026-03-20',
        allDay: true,
        url: '/events/bracket'  // make clickable to link
      }
    ],
    eventClick: this.handleEventClick.bind(this),
    dateClick: this.handleDateClick.bind(this)  // for adding new events
  };

  handleEventClick(info: any) {
    alert(`Event: ${info.event.title}\n${info.event.extendedProps.description || ''}`);
    // You could open a modal with more details here
  }

  handleDateClick(info: any) {
    const title = prompt('Event title (e.g. Game Day Special):');
    if (title) {
      // In real app, save to backend/DB, then refetch/add dynamically
      this.calendarOptions.events = [
        ...(this.calendarOptions.events as any[] || []),
        { title, start: info.dateStr }
      ];
    }
  }
}