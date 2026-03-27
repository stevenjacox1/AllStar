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
  private readonly pacificTimeZone = 'America/Los_Angeles';
  private readonly pacificDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  private readonly pacificDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });
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

  // Use Pacific midnight boundaries so stale state flips at local PST/PDT midnight.
  isOlderThanOneDay(date: string, now: Date = new Date()): boolean {
    const eventMidnightUtcMs = this.parseEventDate(date);
    if (eventMidnightUtcMs === null) {
      return false;
    }

    const todayPacificMidnightUtcMs = this.getPacificMidnightUtcMs(now);
    const oldestAllowedUtcMs = todayPacificMidnightUtcMs - 24 * 60 * 60 * 1000;

    return eventMidnightUtcMs < oldestAllowedUtcMs;
  }

  private parseEventDate(date: string): number | null {
    const [yearRaw, monthRaw, dayRaw] = date.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);

    if (
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    return this.getZonedMidnightUtcMs(year, month, day);
  }

  private getPacificMidnightUtcMs(now: Date): number {
    const { year, month, day } = this.getPacificDateParts(now);
    return this.getZonedMidnightUtcMs(year, month, day);
  }

  private getZonedMidnightUtcMs(year: number, month: number, day: number): number {
    const baseUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
    let zonedMidnightUtcMs = baseUtcMs;

    // Iterate to resolve the correct offset near DST boundaries.
    for (let i = 0; i < 2; i += 1) {
      const offsetMs = this.getPacificOffsetMs(new Date(zonedMidnightUtcMs));
      zonedMidnightUtcMs = baseUtcMs - offsetMs;
    }

    return zonedMidnightUtcMs;
  }

  private getPacificOffsetMs(instant: Date): number {
    const { year, month, day, hour, minute, second } = this.getPacificDateTimeParts(
      instant
    );
    const pacificWallTimeAsUtcMs = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    );

    return pacificWallTimeAsUtcMs - instant.getTime();
  }

  private getPacificDateParts(date: Date): {
    year: number;
    month: number;
    day: number;
  } {
    const parts = this.pacificDateFormatter.formatToParts(date);
    let year = 0;
    let month = 0;
    let day = 0;

    for (const part of parts) {
      if (part.type === 'year') year = Number(part.value);
      if (part.type === 'month') month = Number(part.value);
      if (part.type === 'day') day = Number(part.value);
    }

    return { year, month, day };
  }

  private getPacificDateTimeParts(date: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  } {
    const parts = this.pacificDateTimeFormatter.formatToParts(date);
    let year = 0;
    let month = 0;
    let day = 0;
    let hour = 0;
    let minute = 0;
    let second = 0;

    for (const part of parts) {
      if (part.type === 'year') year = Number(part.value);
      if (part.type === 'month') month = Number(part.value);
      if (part.type === 'day') day = Number(part.value);
      if (part.type === 'hour') hour = Number(part.value);
      if (part.type === 'minute') minute = Number(part.value);
      if (part.type === 'second') second = Number(part.value);
    }

    return { year, month, day, hour, minute, second };
  }
}
