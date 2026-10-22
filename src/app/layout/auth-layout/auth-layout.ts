import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AnimatedBars } from './animated-bars/animated-bars';
import { BackToWebsiteButton } from './back-to-website-button/back-to-website-button';
import { ChronoClock } from './chrono-clock/chrono-clock';

/** Layout de las páginas de autenticación (portal del AuthLayout.vue). */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AnimatedBars, BackToWebsiteButton, ChronoClock],
  templateUrl: './auth-layout.html',
})
export class AuthLayout {}
