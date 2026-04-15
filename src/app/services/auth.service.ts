import { Injectable, signal } from '@angular/core';

const AUTH_KEY = 'assbar_admin_auth';
// Development-only client-side gate; move auth server-side for real security.
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _isAuthenticated = signal(
    !!sessionStorage.getItem(AUTH_KEY)
  );
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  login(username: string, password: string): boolean {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, '1');
      this._isAuthenticated.set(true);
      return true;
    }
    return false;
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_KEY);
    this._isAuthenticated.set(false);
  }
}
