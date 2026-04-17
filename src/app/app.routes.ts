import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { AdminLoginComponent } from './admin/admin-login/admin-login';
import { AdminEventsComponent } from './admin/admin-events/admin-events';
import { AdminGalleryComponent } from './admin/admin-gallery/admin-gallery';
import { AdminMenuPageComponent } from './admin/admin-menu/admin-menu-page';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'admin', component: AdminLoginComponent },
  { path: 'admin/events', component: AdminEventsComponent, canActivate: [authGuard] },
  { path: 'admin/gallery', component: AdminGalleryComponent, canActivate: [authGuard] },
  { path: 'admin/menu', component: AdminMenuPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
