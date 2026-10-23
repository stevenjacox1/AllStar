import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
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
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly siteContent = inject(SiteContentService);

  protected heroText = '';
  protected readonly saving = signal(false);
  protected readonly saveStatus = signal<'idle' | 'success' | 'error'>('idle');

  protected orderingEnabled = false;
  protected orderingUrl = '';
  protected readonly orderingSaving = signal(false);
  protected readonly orderingStatus = signal<'idle' | 'success' | 'error' | 'invalid'>('idle');

  async ngOnInit(): Promise<void> {
    await Promise.all([this.siteContent.loadHeroText(), this.siteContent.loadOnlineOrdering()]);
    this.heroText = this.siteContent.heroText();
    this.orderingEnabled = this.siteContent.onlineOrderingEnabled();
    this.orderingUrl = this.siteContent.onlineOrderingUrl();
    this.cdr.markForCheck();
  }

  protected async saveOrdering(): Promise<void> {
    const url = this.orderingUrl.trim();
    if ((url || this.orderingEnabled) && !/^https?:\/\/\S+$/i.test(url)) {
      this.orderingStatus.set('invalid');
      return;
    }
    this.orderingSaving.set(true);
    this.orderingStatus.set('idle');
    try {
      await this.siteContent.saveOnlineOrdering(this.orderingEnabled, url);
      this.orderingStatus.set('success');
      setTimeout(() => this.orderingStatus.set('idle'), 3000);
    } catch {
      this.orderingStatus.set('error');
    } finally {
      this.orderingSaving.set(false);
    }
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
