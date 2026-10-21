import { Injectable, inject, isDevMode, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const ADMIN_ROLE = 'admin';
const LOGIN_PROVIDER = 'github';

interface ClientPrincipal {
  userDetails: string;
  userRoles: string[];
}

// Authentication is handled by Azure Static Web Apps (/.auth/*); the API write
// routes are restricted to the "admin" role in staticwebapp.config.json.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _principal = signal<ClientPrincipal | null>(null);
  private loadPromise?: Promise<void>;

  readonly isAuthenticated = () =>
    this._principal()?.userRoles.includes(ADMIN_ROLE) ?? false;
  // Signed in with the provider but not granted the admin role.
  readonly isSignedInWithoutAccess = () =>
    !!this._principal() && !this.isAuthenticated();
  readonly userName = () => this._principal()?.userDetails ?? '';

  load(): Promise<void> {
    this.loadPromise ??= this.fetchPrincipal();
    return this.loadPromise;
  }

  private async fetchPrincipal(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ clientPrincipal: ClientPrincipal | null }>('/.auth/me')
      );
      this._principal.set(res?.clientPrincipal ?? null);
    } catch {
      // /.auth/me only exists on Static Web Apps (or the SWA CLI emulator).
      // Local `ng serve` has no auth server, so allow the UI in dev mode only.
      this._principal.set(
        isDevMode() ? { userDetails: 'local-dev', userRoles: ['anonymous', 'authenticated', ADMIN_ROLE] } : null
      );
    }
  }

  login(): void {
    window.location.href = `/.auth/login/${LOGIN_PROVIDER}?post_login_redirect_uri=/admin/events`;
  }

  logout(): void {
    window.location.href = '/.auth/logout?post_logout_redirect_uri=/admin';
  }
}
