import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';

interface GalleryItem {
  day: string;
  markdown: string;
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

  protected readonly days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  protected readonly selectedDay = signal<string>('monday');
  protected readonly markdown = signal<string>('');
  protected readonly loading = signal<boolean>(false);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly error = signal<string>('');
  protected readonly saveSuccess = signal<boolean>(false);

  protected readonly htmlPreview = computed(() => {
    try {
      return marked.parse(this.markdown()) as string;
    } catch {
      return '<p>Error rendering preview</p>';
    }
  });

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
          this.markdown.set(item?.markdown ?? '');
          this.loading.set(false);
        },
        error: (err) => {
          if (err.status === 404 || err.status === 204) {
            this.markdown.set('');
            this.error.set('');
          } else {
            console.error('Error loading gallery content:', err);
            this.markdown.set('');
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
    const content = this.markdown();

    if (!content.trim()) {
      this.error.set('Markdown content cannot be empty');
      return;
    }

    this.isSaving.set(true);
    this.error.set('');
    this.saveSuccess.set(false);

    this.http
      .put<GalleryItem>(`/api/gallery/${day}`, { markdown: content })
      .subscribe({
        next: () => {
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

  insertMarkdown(before: string, after: string = ''): void {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.markdown();
    const selectedText = text.substring(start, end);

    const newText =
      text.substring(0, start) +
      before +
      selectedText +
      after +
      text.substring(end);

    this.markdown.set(newText);

    // Reset cursor position after timeout to allow DOM to update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  }

  bold(): void {
    this.insertMarkdown('**', '**');
  }

  italic(): void {
    this.insertMarkdown('_', '_');
  }

  addHeading(): void {
    this.insertMarkdown('## ');
  }

  addBulletList(): void {
    this.insertMarkdown('- ');
  }

  addLink(): void {
    this.insertMarkdown('[text](', ')');
  }

  clearContent(): void {
    if (confirm('Are you sure you want to clear all content for this day?')) {
      this.markdown.set('');
    }
  }
}
