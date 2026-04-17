import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GalleryEditorComponent } from '../gallery-editor/gallery-editor';
import { SlideshowManagerComponent } from '../slideshow-manager/slideshow-manager';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-gallery',
  imports: [RouterLink, GalleryEditorComponent, SlideshowManagerComponent],
  templateUrl: './admin-gallery.html',
  styleUrl: './admin-gallery.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminGalleryComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin']);
  }
}