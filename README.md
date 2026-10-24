# Kronify Web

Migración del frontend de Kronify a Angular 22 con componentes standalone, signals y
`ChangeDetectionStrategy.OnPush`. La interfaz usa Bootstrap 5 (solo CSS: grid, utilidades,
formularios y botones); el CSS propio queda para tokens, temas y animaciones. La aplicación
cubre autenticación, onboarding, el shell de la zona autenticada, la agenda de citas y la
configuración de cuenta.

## Enlaces

- Repositorio: <https://github.com/BRYANMN0305/kronify-web>
- Sitio principal: <https://kronify.page.gd/>
- API: <https://kronify-apis.duckdns.org>
- OpenAPI: <https://kronify-apis.duckdns.org/v3/api-docs>

## Integrantes

| Persona | Integrante | Alcance |
| --- | --- | --- |
| Persona A | Bryan Muñoz | Autenticación, core, layouts, shared y documentación |
| Persona B | Iglesias Movilla Iryuris | Agenda, citas, servicios, horarios, reseñas y negocio público |

## Requisitos

- Node.js 20 o superior
- npm 11.19.1 (`packageManager` del proyecto)

## Puesta en marcha

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:4200/`.

La URL del backend se configura en `src/environments/environment.ts`.

### Scripts

| Comando | Descripción |
| --- | --- |
| `npm start` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | Análisis estático con ESLint |
| `npm run generate:api` | Regenera los clientes desde OpenAPI |

## Rutas

| Ruta | Acceso | Descripción |
| --- | --- | --- |
| `/iniciar-sesion` | Público | Login con credenciales u OAuth |
| `/registro` | Público | Registro de cliente o negocio |
| `/oauth/callback` | Público | Finalización del login OAuth |
| `/onboarding-negocio` | Autenticado | Wizard de creación del negocio |
| `/calendario` | Autenticado | Agenda de citas; destino posterior al login |
| `/demo-calendario` | Público | Vista previa de la agenda con datos locales |
| `/configuracion` | Autenticado | Configuración de cuenta y negocio con pestaña Mis datos funcional |
| `**` | — | Redirección a `/calendario` |

## Flujo de autenticación

1. `AuthPage` recibe el modo desde la ruta (`withComponentInputBinding`).
2. `LoginForm` o `RegisterForm` validan y emiten el payload.
3. `AuthStore` llama al backend y persiste el token.
4. `navigateAfterAuth()` resuelve invitación pendiente, onboarding o `/calendario`.
5. El `authGuard` protege las rutas autenticadas y redirige a login si no hay sesión.
6. `AgendaPage` carga el rango visible desde la API usando el token de la sesión.

## Árbol de componentes

```text
App
└── RouterOutlet
    ├── AuthPage
    │   └── AuthLayout
    │       ├── AnimatedBars
    │       ├── BackToWebsiteButton
    │       ├── ChronoClock
    │       ├── LoginForm
    │       │   └── OAuthButtons
    │       │       └── OAuthProviderButton
    │       └── RegisterForm
    │           ├── ProfileTypeSelector
    │           └── OAuthButtons
    │               └── OAuthProviderButton
    ├── OAuthCallbackPage
    │   └── AuthLayout
    │       └── ProfileTypeSelector
    ├── OnboardingBusinessPage
    │   └── OnboardingBusinessForm
    │       ├── OnboardingProgressBar
    │       ├── OnboardingStepHeader
    │       ├── CategoryDropdown
    │       └── LogoUpload
    └── AppLayout
        ├── Sidebar
        ├── RouterOutlet
        │   ├── AgendaPage
        │   │   ├── AgendaSummary
        │   │   ├── CalendarGrid
        │   │   └── AppointmentRow
        │   └── SettingsPage
        │       └── MyDetailsTab
        └── BottomNav
```

## Contratos de componentes

| Componente | Inputs | Outputs | Responsabilidad |
| --- | --- | --- | --- |
| `AuthPage` | `mode` (requerido) | — | Alterna login/registro y ejecuta la navegación post-login |
| `LoginForm` | `loading`, `errorMessage`, `oauthRedirecting` (requeridos) | `login`, `switchToRegister`, `oauth` | Valida credenciales y emite el payload |
| `RegisterForm` | `loading`, `errorMessage`, `oauthRedirecting` (requeridos) | `register`, `switchToLogin`, `oauth` | Valida el registro y emite el payload |
| `OAuthButtons` | `disabled` (requerido) | `oauth` | Recorre los proveedores disponibles |
| `OAuthProviderButton` | `provider`, `disabled` (requeridos) | `selected` | Presenta un proveedor OAuth |
| `ProfileTypeSelector` | `profileType` (requerido) | `profileTypeChange` | Selección CLIENT/BUSINESS |
| `AgendaPage` | `demoMode` (opcional) | — | Coordina carga, filtros, día y mes de la agenda |
| `CalendarGrid` | `weeks`, `selectedKey` (requeridos) | `daySelected: Date` | Presenta el mes y emite el día seleccionado |
| `AppointmentRow` | `appointment` (requerido) | `statusChange: AppointmentStatus` | Presenta una cita y emite el cambio de estado |
| `AgendaSummary` | `confirmed`, `total`, `revenue` (requeridos) | — | Presenta indicadores derivados de la agenda |
| `SettingsPage` | — | — | Coordina las pestañas, los datos de `SettingsStore`, el guardado y el logout |
| `MyDetailsTab` | `profile`, `authMethods`, `role`, `saving`, `errorMessage`, `saveCompleted` | `editStarted`, `saveProfile: UserUpdateRequest`, `logout` | Perfil, edición de datos personales y métodos de autenticación |
| `PendingPage` | `title` (requerido) | — | Placeholder de rutas aún no migradas |

## Estado y ownership

| Store / estado | Ubicación | Dueño | Motivo |
| --- | --- | --- | --- |
| `AuthStore` | `core/auth/auth.store.ts` | Persona A | La sesión es global: la consumen guards, interceptor y shell |
| `BusinessStore` | `core/business/business.store.ts` | Persona A | Contexto del negocio compartido entre auth, onboarding y shell |
| `SettingsStore` | `core/settings/settings.store.ts` | Persona A | Datos y plan del negocio usados por el shell |
| `AgendaStore` | `features/agenda/data/agenda.store.ts` | Persona B | Fuente única de citas, carga, error y modo demo |
| Señales locales de formularios | `features/auth/ui/*` | Persona A | Solo el formulario necesita sus campos y errores |

Reglas del estado:

- Los stores exponen señales de solo lectura (`asReadonly()`) y `computed()`.
- Solo los métodos del store modifican su estado.
- `AuthStore` valida que la respuesta incluya un token antes de crear la sesión.
- `logout()` limpia token, usuario, errores y flags de carga/redirección.
- `navigateAfterAuth()` espera la navegación del `Router`.

## Configuración

`SettingsPage` compone el sidebar de secciones y el contenido. La pestaña **Mis datos** está
migrada para todos los roles; las pestañas de negocio (Perfil del negocio, Plan y Equipo) solo
aparecen para el dueño y muestran un placeholder hasta su migración. `MyDetailsTab` es
presentacional: recibe perfil, métodos de autenticación, rol y estado de guardado, y emite
`saveProfile`/`logout`. `SettingsStore.updateProfile()` persiste los cambios y fusiona la
respuesta en el perfil cacheado; las fechas se presentan con el pipe `dateFmt`.

## Agenda

`AgendaStore` es dueño del listado de citas, carga, error y modo demo. Mantiene signals
privadas y cambia datos mediante `loadDemo`, `loadRange` y `updateStatus`. La agenda consulta
`AppointmentControllerService` y `ServiceControllerService` usando el token de la sesión.
`/demo-calendario` fuerza los datos locales; `/calendario` requiere autenticación y es el
destino posterior al login.

La interfaz `Appointment` está en
`src/app/features/agenda/modelos/appointment.model.ts`; los ocho registros locales de respaldo
están en `src/app/features/agenda/datos/appointments.data.ts`. Son datos sintéticos para
evaluación, no citas reales.

La API documentada por el equipo está en
<https://kronify-apis.duckdns.org/swagger-ui/index.html#/>.
