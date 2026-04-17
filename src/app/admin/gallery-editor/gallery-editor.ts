import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { timeout } from 'rxjs';

interface GalleryItem {
  key: string;
  day: string | null;
  isDaySection: boolean;
  sortOrder: number;
  html: string;
  caption: string;
  imageUrl: string;
}

interface EditableCard {
  key: string;
  label: string;
  isDaySection: boolean;
}

const DEFAULT_DAY_CAPTIONS: Record<string, string> = {
  monday: 'Miller Monday',
  tuesday: 'Taco Tuesday',
  wednesday: 'Hornitos Humpday',
  thursday: 'Crown Royal Thursday',
  friday: 'Fireball Friday',
  saturday: 'Svedka Saturday',
  sunday: 'Sunday All-Day Action'
};

const DEFAULT_SECTION_HTML = '<p>Special details are unavailable right now.</p>';
const IMAGE_UPLOAD_TIMEOUT_MS = 20000;

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
  protected readonly selectedKey = signal<string>('monday');
  protected readonly allItems = signal<GalleryItem[]>([]);
  protected readonly html = signal<string>('');
  protected readonly caption = signal<string>('');
  protected readonly imageUrl = signal<string>('');
  protected readonly newSectionTitle = signal<string>('');
  protected readonly loading = signal<boolean>(false);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly uploadingImageKey = signal<string | null>(null);
  protected readonly savingImageKey = signal<string | null>(null);
  protected readonly imageSaveSuccessKey = signal<string>('');
  protected readonly lastUploadedFileNames = signal<Record<string, string>>({});
  protected readonly error = signal<string>('');
  protected readonly saveSuccess = signal<boolean>(false);

  protected readonly extraSections = computed(() =>
    this.allItems()
      .filter(item => !item.isDaySection)
      .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
  );

  protected readonly selectedSectionLabel = computed(() => {
    const key = this.selectedKey();
    if (this.isDayKey(key)) {
      return key;
    }
    const match = this.extraSections().find(section => section.key === key);
    return match?.caption || key;
  });

  protected readonly htmlPreview = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(normalizeHtml(this.html()))
  );

  protected readonly editableCards = computed<EditableCard[]>(() => {
    const extraCards = this.extraSections().map(section => ({
      key: section.key,
      label: section.caption,
      isDaySection: false
    }));

    const dayCards = this.days.map(day => ({
      key: day,
      label: DEFAULT_DAY_CAPTIONS[day] || day,
      isDaySection: true
    }));

    return [...dayCards, ...extraCards];
  });

  constructor() {
    this.refreshAllContent();

    // Load selected section content when selection changes.
    effect(() => {
      this.allItems();
      const key = this.selectedKey();
      this.loadGalleryContent(key);
    });
  }

  private refreshAllContent(): void {
    this.http.get<GalleryItem[]>('/api/gallery').subscribe({
      next: items => {
        this.allItems.set(items ?? []);
      },
      error: (err) => {
        console.error('Error loading gallery list:', err);
      }
    });
  }

  private loadGalleryContent(key: string): void {
    this.loading.set(true);
    this.error.set('');

    if (!this.isDayKey(key)) {
      const existingSection = this.extraSections().find(section => section.key === key);
      this.html.set(existingSection?.html ?? '');
      this.caption.set(existingSection?.caption ?? '');
      this.imageUrl.set(existingSection?.imageUrl ?? '');
      this.loading.set(false);
      return;
    }

    this.http
      .get<GalleryItem | null>(`/api/gallery/${key}`)
      .subscribe({
        next: (item) => {
          this.html.set(item?.html ?? '');
          this.caption.set(item?.caption ?? '');
          this.imageUrl.set(item?.imageUrl ?? '');
          this.loading.set(false);
        },
        error: (err) => {
          if (err.status === 404 || err.status === 204) {
            this.html.set('');
            this.caption.set('');
            this.imageUrl.set('');
            this.error.set('');
          } else {
            console.error('Error loading gallery content:', err);
            this.html.set('');
            this.caption.set('');
            this.imageUrl.set('');
            this.error.set('Failed to load gallery content');
          }
          this.loading.set(false);
        }
      });
  }

  private isDayKey(key: string): boolean {
    return this.days.includes(key);
  }

  private toSectionSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  selectKey(key: string): void {
    this.selectedKey.set(key);
    this.error.set('');
    this.saveSuccess.set(false);
  }

  createSection(): void {
    const title = this.newSectionTitle().trim();
    if (!title) {
      this.error.set('Section title is required');
      return;
    }

    const slug = this.toSectionSlug(title);
    if (!slug) {
      this.error.set('Section title must include letters or numbers');
      return;
    }

    const key = `extra:${slug}`;
    const alreadyExists = this.extraSections().some(section => section.key === key);
    if (alreadyExists) {
      this.error.set('A section with that title already exists');
      return;
    }

    this.isSaving.set(true);
    this.error.set('');

    this.http
      .post<GalleryItem>('/api/gallery', {
        key,
        caption: title,
        html: '<p>Enter section details here...</p>'
      })
      .subscribe({
        next: () => {
          this.newSectionTitle.set('');
          this.refreshAllContent();
          this.selectKey(key);
          this.isSaving.set(false);
          this.saveSuccess.set(true);
          setTimeout(() => this.saveSuccess.set(false), 3000);
        },
        error: (err) => {
          console.error('Error creating custom section:', err);
          this.isSaving.set(false);
          this.error.set('Failed to create section');
        }
      });
  }

  saveContent(): void {
    const key = this.selectedKey();
    const content = normalizeHtml(this.html());
    const caption = this.caption().trim();
    const imageUrl = this.imageUrl().trim();

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

    if (!this.isDayKey(key)) {
      const existingSection = this.extraSections().find(section => section.key === key);
      this.http
        .post<GalleryItem>('/api/gallery', {
          key,
          html: content,
          caption,
          imageUrl,
          sortOrder: existingSection?.sortOrder
        })
        .subscribe({
          next: () => {
            this.html.set(content);
            this.caption.set(caption);
            this.isSaving.set(false);
            this.refreshAllContent();
            this.saveSuccess.set(true);
            setTimeout(() => this.saveSuccess.set(false), 3000);
          },
          error: (err) => {
            console.error('Error saving gallery section:', err);
            this.isSaving.set(false);
            this.error.set('Failed to save gallery section');
          }
        });
      return;
    }

    this.http
      .put<GalleryItem>(`/api/gallery/${key}`, { html: content, caption, imageUrl })
      .subscribe({
        next: () => {
          this.html.set(content);
          this.caption.set(caption);
          this.isSaving.set(false);
          this.refreshAllContent();
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
    const selectedLabel = this.selectedSectionLabel();
    if (confirm(`Are you sure you want to clear all content for ${selectedLabel}?`)) {
      this.html.set('');
    }
  }

  clearImage(): void {
    this.imageUrl.set('');
  }

  protected isImageBusyForKey(key: string): boolean {
    return this.uploadingImageKey() === key || this.savingImageKey() === key;
  }

  protected cardImageUrl(key: string): string {
    if (this.selectedKey() === key) {
      return this.imageUrl().trim();
    }

    return this.allItems().find(item => item.key === key)?.imageUrl?.trim() ?? '';
  }

  protected uploadedFileNameForKey(key: string): string {
    return this.lastUploadedFileNames()[key] ?? '';
  }

  protected uploadImageForKey(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.error.set('Only image files are allowed');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.error.set('Image must be 5MB or smaller');
      input.value = '';
      return;
    }

    this.uploadingImageKey.set(key);
    this.imageSaveSuccessKey.set('');
    this.error.set('');
    const uploadedFileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = typeof reader.result === 'string' ? reader.result : '';

      this.http
        .post<{ imageUrl: string }>('/api/gallery-image', {
          sectionKey: key,
          imageDataUrl
        })
        .pipe(timeout(IMAGE_UPLOAD_TIMEOUT_MS))
        .subscribe({
          next: (result) => {
            this.uploadingImageKey.set(null);
            const uploadedImageUrl = (result.imageUrl || '').trim();

            if (!uploadedImageUrl) {
              this.error.set('Image upload did not return a usable URL');
              input.value = '';
              return;
            }

            this.persistImageUrl(key, uploadedImageUrl, uploadedFileName);
            input.value = '';
          },
          error: (err) => {
            console.error('Error uploading gallery image:', err);
            this.error.set('Image upload failed or timed out.');
            this.uploadingImageKey.set(null);
            input.value = '';
          }
        });
    };

    reader.onerror = () => {
      this.error.set('Failed to read selected image');
      this.uploadingImageKey.set(null);
      input.value = '';
    };

    reader.readAsDataURL(file);
  }

  uploadImage(event: Event): void {
    this.uploadImageForKey(this.selectedKey(), event);
  }

  private persistImageUrl(key: string, imageUrl: string, uploadedFileName: string): void {
    const existing = this.allItems().find(item => item.key === key);
    const html = normalizeHtml(
      (existing?.html ?? (this.selectedKey() === key ? this.html() : '')).trim() || DEFAULT_SECTION_HTML
    );
    const caption = (
      (existing?.caption ?? (this.selectedKey() === key ? this.caption() : '')).trim() || this.defaultCaptionForKey(key)
    );

    this.savingImageKey.set(key);

    if (this.isDayKey(key)) {
      this.http
        .put<GalleryItem>(`/api/gallery/${key}`, { html, caption, imageUrl })
        .subscribe({
          next: () => this.handleImageSaveSuccess(key, imageUrl, uploadedFileName),
          error: (err) => {
            console.error('Error saving day image:', err);
            this.savingImageKey.set(null);
            this.error.set('Failed to save image for selected card');
          }
        });
      return;
    }

    this.http
      .post<GalleryItem>('/api/gallery', {
        key,
        html,
        caption,
        imageUrl,
        sortOrder: existing?.sortOrder
      })
      .subscribe({
        next: () => this.handleImageSaveSuccess(key, imageUrl, uploadedFileName),
        error: (err) => {
          console.error('Error saving extra section image:', err);
          this.savingImageKey.set(null);
          this.error.set('Failed to save image for selected card');
        }
      });
  }

  private handleImageSaveSuccess(key: string, imageUrl: string, uploadedFileName: string): void {
    if (this.selectedKey() === key) {
      this.imageUrl.set(imageUrl);
    }

    if (uploadedFileName) {
      this.lastUploadedFileNames.update(fileNames => ({
        ...fileNames,
        [key]: uploadedFileName
      }));
    }

    this.refreshAllContent();
    this.savingImageKey.set(null);
    this.imageSaveSuccessKey.set(key);
    setTimeout(() => {
      if (this.imageSaveSuccessKey() === key) {
        this.imageSaveSuccessKey.set('');
      }
    }, 2500);
  }

  private defaultCaptionForKey(key: string): string {
    if (this.isDayKey(key)) {
      return DEFAULT_DAY_CAPTIONS[key] || key;
    }

    return this.extraSections().find(section => section.key === key)?.caption || 'Additional Special';
  }
}
