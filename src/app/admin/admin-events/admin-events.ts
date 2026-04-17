import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { EventsService, BarEvent } from '../../services/events.service';

@Component({
  selector: 'app-admin-events',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './admin-events.html',
  styleUrl: './admin-events.css'
})
export class AdminEventsComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  protected readonly eventsService = inject(EventsService);

  protected readonly showForm = signal(false);
  protected readonly editingId = signal<string | null>(null);

  protected formTitle = '';
  protected formDate = '';
  protected formTime = '';
  protected formDescription = '';
  protected formImageUrl = '';
  protected isUploadingImage = false;
  protected uploadError = '';

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
    this.formImageUrl = event.imageUrl;
    this.showForm.set(true);
  }

  save(): void {
    if (!this.formTitle.trim() || !this.formDate) return;
    const data = {
      title: this.formTitle.trim(),
      date: this.formDate,
      time: this.formTime.trim(),
      description: this.formDescription.trim(),
      imageUrl: this.formImageUrl.trim()
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

  protected clearImage(): void {
    this.formImageUrl = '';
  }

  protected uploadEventImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.uploadError = 'Only image files are allowed.';
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.uploadError = 'Image must be 5MB or smaller.';
      input.value = '';
      return;
    }

    this.isUploadingImage = true;
    this.uploadError = '';

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = typeof reader.result === 'string' ? reader.result : '';
      const sectionKey = this.editingId() || `event-${Date.now()}`;

      this.http
        .post<{ imageUrl: string }>('/api/gallery-image', { sectionKey, imageDataUrl })
        .subscribe({
          next: result => {
            this.formImageUrl = result.imageUrl || '';
            this.isUploadingImage = false;
            input.value = '';
          },
          error: error => {
            console.error('Failed to upload event image', error);
            this.uploadError = 'Failed to upload image.';
            this.isUploadingImage = false;
            input.value = '';
          }
        });
    };

    reader.onerror = () => {
      this.uploadError = 'Failed to read selected image file.';
      this.isUploadingImage = false;
      input.value = '';
    };

    reader.readAsDataURL(file);
  }

  protected isOlderThanOneDay(date: string): boolean {
    return this.eventsService.isOlderThanOneDay(date);
  }

  private resetForm(): void {
    this.formTitle = '';
    this.formDate = '';
    this.formTime = '';
    this.formDescription = '';
    this.formImageUrl = '';
    this.isUploadingImage = false;
    this.uploadError = '';
  }
}
