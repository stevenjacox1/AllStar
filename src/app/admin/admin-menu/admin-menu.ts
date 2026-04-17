import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface MenuItem {
  id: string;
  name: string;
  price: string;
  description: string;
}

export interface MenuSection {
  id: string;
  title: string;
  type: 'items' | 'grid' | 'tags';
  note: string | null;
  items: MenuItem[];
}

export interface MenuData {
  sections: MenuSection[];
}

let idCounter = 1;
function genId(): string {
  return 'new-' + (idCounter++);
}

@Component({
  selector: 'app-admin-menu',
  imports: [FormsModule],
  templateUrl: './admin-menu.html',
  styleUrl: './admin-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminMenuComponent {
  private readonly http = inject(HttpClient);

  protected readonly menu = signal<MenuData | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saveStatus = signal<'idle' | 'success' | 'error'>('idle');
  protected readonly expandedSections = signal<Set<string>>(new Set());
  protected readonly editingSection = signal<string | null>(null);

  protected readonly sections = computed(() => this.menu()?.sections ?? []);

  constructor() {
    this.http.get<MenuData>('/api/menu').subscribe({
      next: data => {
        this.menu.set(JSON.parse(JSON.stringify(data)));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  protected isExpanded(sectionId: string): boolean {
    return this.expandedSections().has(sectionId);
  }

  protected toggleSection(sectionId: string): void {
    const set = new Set(this.expandedSections());
    if (set.has(sectionId)) {
      set.delete(sectionId);
    } else {
      set.add(sectionId);
    }
    this.expandedSections.set(set);
  }

  protected updateSectionTitle(section: MenuSection, title: string): void {
    section.title = title;
    this.touch();
  }

  protected updateSectionNote(section: MenuSection, note: string): void {
    section.note = note || null;
    this.touch();
  }

  protected updateSectionType(section: MenuSection, type: string): void {
    section.type = type as MenuSection['type'];
    this.touch();
  }

  protected updateItem(item: MenuItem, field: keyof MenuItem, value: string): void {
    (item as any)[field] = value;
    this.touch();
  }

  protected addItem(section: MenuSection): void {
    section.items.push({ id: genId(), name: 'New Item', price: '', description: '' });
    this.touch();
  }

  protected removeItem(section: MenuSection, item: MenuItem): void {
    section.items = section.items.filter(i => i !== item);
    this.touch();
  }

  protected moveItem(section: MenuSection, item: MenuItem, dir: -1 | 1): void {
    const idx = section.items.indexOf(item);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= section.items.length) return;
    const arr = [...section.items];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    section.items = arr;
    this.touch();
  }

  protected addSection(): void {
    const data = this.menu();
    if (!data) return;
    data.sections.push({
      id: genId(),
      title: 'New Section',
      type: 'items',
      note: null,
      items: []
    });
    this.touch();
    // expand the new section
    const newId = data.sections[data.sections.length - 1].id;
    const set = new Set(this.expandedSections());
    set.add(newId);
    this.expandedSections.set(set);
  }

  protected removeSection(section: MenuSection): void {
    const data = this.menu();
    if (!data) return;
    data.sections = data.sections.filter(s => s !== section);
    this.touch();
  }

  protected moveSection(section: MenuSection, dir: -1 | 1): void {
    const data = this.menu();
    if (!data) return;
    const idx = data.sections.indexOf(section);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= data.sections.length) return;
    const arr = [...data.sections];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    data.sections = arr;
    this.touch();
  }

  private touch(): void {
    // trigger signal update by reassigning the object reference
    const data = this.menu();
    if (data) this.menu.set({ ...data });
  }

  protected save(): void {
    const data = this.menu();
    if (!data || this.saving()) return;
    this.saving.set(true);
    this.saveStatus.set('idle');
    this.http.put('/api/menu', data).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveStatus.set('success');
        setTimeout(() => this.saveStatus.set('idle'), 3000);
      },
      error: () => {
        this.saving.set(false);
        this.saveStatus.set('error');
      }
    });
  }
}
