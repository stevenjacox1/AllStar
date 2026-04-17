import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminMenuComponent } from './admin-menu';

@Component({
  selector: 'app-admin-menu-page',
  imports: [RouterLink, AdminMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="min-h-screen bg-gray-950 text-white">
  <header class="bg-red-800 shadow-xl px-6 py-4 flex items-center justify-between">
    <h1 class="text-2xl font-black uppercase tracking-tight">Admin</h1>
    <button
      (click)="logout()"
      class="text-sm font-medium bg-gray-900/50 hover:bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 transition-colors"
    >
      Log Out
    </button>
  </header>

  <div class="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
    <nav class="max-w-5xl mx-auto flex" aria-label="Admin sections">
      <a routerLink="/admin/events"
        class="px-6 py-4 font-semibold border-b-2 border-gray-700 text-gray-400 transition hover:text-white">
        Events
      </a>
      <a routerLink="/admin/gallery"
        class="px-6 py-4 font-semibold border-b-2 border-gray-700 text-gray-400 transition hover:text-white">
        Gallery Content
      </a>
      <a routerLink="/admin/menu" aria-current="page"
        class="px-6 py-4 font-semibold border-b-2 border-red-600 text-white transition hover:text-white">
        Menu
      </a>
    </nav>
  </div>

  <main class="max-w-5xl mx-auto px-6 py-12">
    <app-admin-menu></app-admin-menu>
  </main>
</div>
  `
})
export class AdminMenuPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin']);
  }
}
