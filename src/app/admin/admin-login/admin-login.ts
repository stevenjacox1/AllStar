import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css'
})
export class AdminLoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected username = '';
  protected password = '';
  protected errorMessage = signal('');

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/admin/events']);
    }
  }

  submit(): void {
    if (this.authService.login(this.username, this.password)) {
      this.router.navigate(['/admin/events']);
    } else {
      this.errorMessage.set('Invalid username or password.');
      this.password = '';
    }
  }
}
