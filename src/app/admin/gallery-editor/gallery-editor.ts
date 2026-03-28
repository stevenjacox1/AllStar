import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface GalleryItem {
  day: string;
  html: string;
  caption: string;
}

function normalizeHtml(html: string): string {
  return html.replace(/font-color\s*:/gi, 'color:');
}

@Component({
  selector: 'app-gallery-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './gallery-editor.html',
  styleUrl: './gallery-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryEditorComponent {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  protected readonly selectedDay = signal<string>('monday');
  protected readonly html = signal<string>('');
  protected readonly caption = signal<string>('');
  protected readonly loading = signal<boolean>(false);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly error = signal<string>('');
  protected readonly saveSuccess = signal<boolean>(false);

  protected readonly htmlPreview = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(normalizeHtml(this.html()))
  );

  constructor() {
    // Load gallery content when selected day changes
    effect(() => {
      const day = this.selectedDay();
      this.loadGalleryContent(day);
    });
  }

  private loadGalleryContent(day: string): void {
    this.loading.set(true);
    this.error.set('');

    this.http
      .get<GalleryItem | null>(`/api/gallery/${day}`)
      .subscribe({
        next: (item) => {
          this.html.set(item?.html ?? '');
          this.caption.set(item?.caption ?? '');
          this.loading.set(false);
        },
        error: (err) => {
          if (err.status === 404 || err.status === 204) {
            this.html.set('');
            this.caption.set('');
            this.error.set('');
          } else {
            console.error('Error loading gallery content:', err);
            this.html.set('');
            this.caption.set('');
            this.error.set('Failed to load gallery content');
          }
          this.loading.set(false);
        }
      });
  }

  selectDay(day: string): void {
    this.selectedDay.set(day);
  }

  saveContent(): void {
    const day = this.selectedDay();
    const content = normalizeHtml(this.html());
    const caption = this.caption().trim();

    if (!content.trim()) {
      this.error.set('HTML content cannot be empty');
      return;
    }

    if (!caption) {
      this.error.set('Caption cannot be empty');
      return;
    }

    this.isSaving.set(true);
    this.error.set('');
    this.saveSuccess.set(false);

    this.http
      .put<GalleryItem>(`/api/gallery/${day}`, { html: content, caption })
      .subscribe({
        next: () => {
          this.html.set(content);
          this.caption.set(caption);
          this.isSaving.set(false);
          this.saveSuccess.set(true);
          setTimeout(() => this.saveSuccess.set(false), 3000);
        },
        error: (err) => {
          console.error('Error saving gallery content:', err);
          this.isSaving.set(false);
          this.error.set('Failed to save gallery content');
        }
      });
  }

  insertHtml(before: string, after: string = ''): void {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.html();
    const selectedText = text.substring(start, end);

    const newText =
      text.substring(0, start) +
      before +
      selectedText +
      after +
      text.substring(end);

    this.html.set(newText);

    // Reset cursor position after timeout to allow DOM to update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  }

  wrapStrong(): void {
    this.insertHtml('<strong>', '</strong>');
  }

  wrapEmphasis(): void {
    this.insertHtml('<em>', '</em>');
  }

  addHeading(): void {
    this.insertHtml('<h2>', '</h2>');
  }

  addParagraph(): void {
    this.insertHtml('<p>', '</p>');
  }

  addLink(): void {
    this.insertHtml('<a href="https://">', '</a>');
  }

  clearContent(): void {
    if (confirm('Are you sure you want to clear all content for this day?')) {
      this.html.set('');
    }
  }
}
