import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Quien llega desde el QR de una nota vuelve a esa nota después de iniciar sesión.
  return state.url && state.url !== '/'
    ? router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })
    : router.parseUrl('/login');
};
