import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SiteContentService } from '../../services/site-content.service';

@Component({
  selector: 'app-admin-site-content',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-site-content.html'
})
export class AdminSiteContentComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly siteContent = inject(SiteContentService);

  protected heroText = '';
  protected readonly saving = signal(false);
  protected readonly saveStatus = signal<'idle' | 'success' | 'error'>('idle');

  ngOnInit(): void {
    this.siteContent.loadHeroText();
    this.heroText = this.siteContent.heroText();
  }

  protected async save(): Promise<void> {
    if (!this.heroText.trim()) return;
    this.saving.set(true);
    this.saveStatus.set('idle');
    try {
      await this.siteContent.saveHeroText(this.heroText.trim());
      this.saveStatus.set('success');
      setTimeout(() => this.saveStatus.set('idle'), 3000);
    } catch {
      this.saveStatus.set('error');
    } finally {
      this.saving.set(false);
    }
  }

  protected logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin']);
  }
}
