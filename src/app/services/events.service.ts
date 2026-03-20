import { Injectable, signal } from '@angular/core';

export interface BarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  description: string;
}

const STORAGE_KEY = 'assbar_events';

const DEFAULT_EVENTS: BarEvent[] = [
  {
    id: '1',
    title: 'UFC Fight Night Watch Party',
    date: '2026-03-22',
    time: '7:00 PM',
    description: 'Watch all the fights live on our big screens. $5 drinks all night!'
  },
  {
    id: '2',
    title: 'March Madness Bracket Challenge',
    date: '2026-03-26',
    time: '12:00 PM',
    description: 'Sign up for our bracket challenge. Winner gets a $100 bar tab!'
  },
  {
    id: '3',
    title: 'Sunday Trivia Night',
    date: '2026-03-29',
    time: '7:00 PM',
    description: 'Sports trivia with prizes for first, second, and third place teams.'
  }
];

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly _events = signal<BarEvent[]>(this.load());
  readonly events = this._events.asReadonly();

  private load(): BarEvent[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as BarEvent[]) : DEFAULT_EVENTS;
    } catch {
      return DEFAULT_EVENTS;
    }
  }

  private save(events: BarEvent[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  add(event: Omit<BarEvent, 'id'>): void {
    const newEvent: BarEvent = { ...event, id: Date.now().toString() };
    const updated = [...this._events(), newEvent].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    this._events.set(updated);
    this.save(updated);
  }

  update(id: string, changes: Omit<BarEvent, 'id'>): void {
    const updated = this._events()
      .map(e => (e.id === id ? { ...e, ...changes } : e))
      .sort((a, b) => a.date.localeCompare(b.date));
    this._events.set(updated);
    this.save(updated);
  }

  remove(id: string): void {
    const updated = this._events().filter(e => e.id !== id);
    this._events.set(updated);
    this.save(updated);
  }
}
