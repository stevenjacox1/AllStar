import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css'
})
export class AdminLoginComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.authService.load();
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/admin/events']);
    }
  }

  protected signIn(): void {
    this.authService.login();
  }

  protected signOut(): void {
    this.authService.logout();
  }
}
