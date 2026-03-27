import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { EventsService, BarEvent } from '../../services/events.service';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './admin-events.html',
  styleUrl: './admin-events.css'
})
export class AdminEventsComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly eventsService = inject(EventsService);

  protected readonly showForm = signal(false);
  protected readonly editingId = signal<string | null>(null);

  protected formTitle = '';
  protected formDate = '';
  protected formTime = '';
  protected formDescription = '';

  openAddForm(): void {
    this.editingId.set(null);
    this.resetForm();
    this.showForm.set(true);
  }

  openEditForm(event: BarEvent): void {
    this.editingId.set(event.id);
    this.formTitle = event.title;
    this.formDate = event.date;
    this.formTime = event.time;
    this.formDescription = event.description;
    this.showForm.set(true);
  }

  save(): void {
    if (!this.formTitle.trim() || !this.formDate) return;
    const data = {
      title: this.formTitle.trim(),
      date: this.formDate,
      time: this.formTime.trim(),
      description: this.formDescription.trim()
    };
    const id = this.editingId();
    if (id) {
      this.eventsService.update(id, data);
    } else {
      this.eventsService.add(data);
    }
    this.cancelForm();
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.resetForm();
  }

  remove(id: string): void {
    if (confirm('Delete this event?')) {
      this.eventsService.remove(id);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin']);
  }

  protected isOlderThanOneDay(date: string): boolean {
    return this.eventsService.isOlderThanOneDay(date);
  }

  private resetForm(): void {
    this.formTitle = '';
    this.formDate = '';
    this.formTime = '';
    this.formDescription = '';
  }
}
