import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/api/jwt.interceptor';
import { JsonConfiguration } from './core/api/json-configuration';
import { provideApi } from './core/api/openapi/provide-api';
import { Configuration } from './core/api/openapi/configuration';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideApi(environment.apiUrl),
    {
      provide: Configuration,
      useValue: new JsonConfiguration({ basePath: environment.apiUrl }),
    },
  ],
};
