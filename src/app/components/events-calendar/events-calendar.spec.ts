import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventsCalendar } from './events-calendar';

describe('EventsCalendar', () => {
  let component: EventsCalendar;
  let fixture: ComponentFixture<EventsCalendar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsCalendar],
    }).compileComponents();

    fixture = TestBed.createComponent(EventsCalendar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
