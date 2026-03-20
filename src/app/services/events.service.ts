import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface BarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  description: string;
}

type EventPayload = Omit<BarEvent, 'id'>;

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/events';
  private readonly _events = signal<BarEvent[]>([]);
  readonly events = this._events.asReadonly();

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.http.get<BarEvent[]>(this.apiUrl).subscribe({
      next: events => {
        const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
        this._events.set(sorted);
      },
      error: error => {
        console.error('Failed to load events from API', error);
      }
    });
  }

  add(event: EventPayload): void {
    this.http.post<BarEvent>(this.apiUrl, event).subscribe({
      next: created => {
        const updated = [...this._events(), created].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        this._events.set(updated);
      },
      error: error => {
        console.error('Failed to create event', error);
      }
    });
  }

  update(id: string, changes: EventPayload): void {
    this.http.put<BarEvent>(`${this.apiUrl}/${id}`, changes).subscribe({
      next: saved => {
        const updated = this._events()
          .map(e => (e.id === id ? saved : e))
          .sort((a, b) => a.date.localeCompare(b.date));
        this._events.set(updated);
      },
      error: error => {
        console.error('Failed to update event', error);
      }
    });
  }

  remove(id: string): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        const updated = this._events().filter(e => e.id !== id);
        this._events.set(updated);
      },
      error: error => {
        console.error('Failed to delete event', error);
      }
    });
  }
}
