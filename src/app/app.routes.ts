import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { AdminLoginComponent } from './admin/admin-login/admin-login';
import { AdminEventsComponent } from './admin/admin-events/admin-events';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'admin', component: AdminLoginComponent },
  { path: 'admin/events', component: AdminEventsComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
