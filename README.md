# Kronify Web

Migración del frontend de Kronify a Angular 22 con componentes standalone, signals y
`ChangeDetectionStrategy.OnPush`. La interfaz usa Bootstrap 5 (solo CSS: grid, utilidades,
formularios y botones); el CSS propio queda para tokens, temas y animaciones. La aplicación
cubre autenticación, invitaciones de equipo, onboarding, el shell de la zona autenticada, la
agenda de citas y la configuración completa de cuenta y negocio (datos, contraseña, perfil,
plan con gráficas de Chart.js y equipo).

## Enlaces

- Repositorio: <https://github.com/BRYANMN0305/kronify-web>
- Sitio principal: <https://kronify.page.gd/>
- API: <https://kronify-apis.duckdns.org>
- OpenAPI: <https://kronify-apis.duckdns.org/v3/api-docs>

## Integrantes

| Integrante | Alcance |
| --- | --- |
| Bryan Muñoz | Autenticación, core, layouts, shared y documentación |
| Iglesias Movilla Iryuris | Agenda, citas, servicios, horarios, reseñas y negocio público |

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
| `/invitacion/aceptar` | Público | Aceptación de invitaciones de empleado, con o sin sesión |
| `/onboarding-negocio` | Autenticado | Wizard de creación del negocio |
| `/calendario` | Autenticado | Agenda de citas; destino posterior al login |
| `/demo-calendario` | Público | Vista previa de la agenda con datos locales |
| `/configuracion` | Autenticado | Configuración de cuenta y negocio con todas las pestañas funcionales |
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
        │       ├── MyDetailsTab
        │       ├── PasswordTab
        │       ├── ProfileTab
        │       │   ├── CategoryDropdown
        │       │   └── LogoUpload
        │       ├── PlanTab
        │       │   └── UsageChart
        │       └── TeamTab
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
| `PasswordTab` | `saving`, `errorMessage`, `saveCompleted` | `savePassword: UserChangePasswordRequest` | Cambio de contraseña con validación local |
| `ProfileTab` | `business`, `publicUrl`, `ownerAsEmployee`, `toggling`, `toggleError`, `saving`, `errorMessage`, `saveCompleted` | `editStarted`, `updateBusiness: BusinessProfileSubmitPayload`, `toggleOwner` | Perfil público del negocio, logo, contacto y toggle de dueño-empleado |
| `PlanTab` | `plan`, `availablePlans`, `planHistory`, `changingPlanId`, `errorMessage`, `changeCompleted` | `changePlan: PlanChangeRequest` | Plan actual, uso con Chart.js, catálogo e historial |
| `UsageChart` | `label`, `data`, `options` | — | Doughnut de una métrica de uso con Chart.js |
| `TeamTab` | `invitations`, `sending`, `busyId`, `successMessage`, `errorMessage` | `createInvitation`, `resendInvitation`, `cancelInvitation` | Invitaciones del equipo y acciones por fila |

## Estado y ownership

| Store / estado | Ubicación | Motivo |
| --- | --- | --- |
| `AuthStore` | `core/auth/auth.store.ts` | La sesión es global: la consumen guards, interceptor y shell |
| `BusinessStore` | `core/business/business.store.ts` | Contexto del negocio compartido entre auth, onboarding y shell |
| `SettingsStore` | `core/settings/settings.store.ts` | Datos de cuenta, negocio, invitaciones, plan, catálogo e historial |
| `AgendaStore` | `features/agenda/data/agenda.store.ts` | Fuente única de citas, carga, error y modo demo |
| Señales locales de formularios | `features/auth/ui/*` | Solo el formulario necesita sus campos y errores |

Reglas del estado:

- Los stores exponen señales de solo lectura (`asReadonly()`) y `computed()`.
- Solo los métodos del store modifican su estado.
- `AuthStore` valida que la respuesta incluya un token antes de crear la sesión.
- `logout()` limpia token, usuario, errores y flags de carga/redirección.
- `navigateAfterAuth()` espera la navegación del `Router`.

## Cómo leer y mantener el código

La documentación vive junto a la pieza que explica. Cada componente, store, pipe, ruta o
tipo propio empieza con un comentario corto que responde qué resuelve y qué parte del flujo
le corresponde. Los comentarios dentro de un método solo se usan cuando hay una regla de
negocio, una compatibilidad temporal o una decisión que no sea evidente por el
nombre del código.

- **Páginas** coordinan la pantalla, las rutas y los stores; no hacen peticiones HTTP
  directamente.
- **Componentes de `ui/`** reciben datos por `input`, emiten acciones por `output` y no son
  dueños del estado remoto.
- **Stores** son dueños del estado compartido y de las llamadas al API. Exponen señales de
  solo lectura cuando la vista no debe modificarlas.
- **`core/`** contiene reglas transversales: sesión, permisos, fecha, configuración HTTP y
  contexto del negocio. No debe importar elementos visuales de `features/`.
- **`features/`** agrupa una capacidad completa. Un tipo temporal de compatibilidad debe
  indicar cuál es su archivo canónico para evitar contratos duplicados.
- **`core/api/openapi/`** es código generado. No se edita a mano ni se documenta localmente:
  cualquier cambio duradero se hace en el contrato OpenAPI o en la configuración del generador.

Al agregar una pieza nueva, documenta la responsabilidad y el límite de esa pieza, no una
traducción literal de cada línea. Por ejemplo, explica por qué un guard consulta un store o
por qué un formulario emite un evento, pero no que `set(true)` cambia una señal a `true`.

## Configuración

`SettingsPage` compone el sidebar de secciones y el contenido. La pestaña **Mis datos** y la
pestaña **Contraseña** están disponibles para todos los roles; las pestañas de negocio
(**Perfil del negocio**, **Plan** y **Equipo**) solo aparecen para el dueño.

- **Mis datos** (`MyDetailsTab`): perfil, edición de datos personales y métodos de
  autenticación. `SettingsStore.updateProfile()` persiste los cambios y fusiona la respuesta
  en el perfil cacheado; el logout delega en `AuthStore`.
- **Contraseña** (`PasswordTab`): valida contraseña actual, nueva y confirmación, y llama a
  `SettingsStore.updatePassword()`. El formulario se limpia cuando el padre confirma el
  guardado.
- **Perfil del negocio** (`ProfileTab`): muestra y edita nombre, categoría, descripción,
  contacto, logo y URL pública. Reutiliza `CategoryDropdown` y `LogoUpload` del onboarding.
  `SettingsStore.uploadLogo()` sube un archivo nuevo y `updateBusiness()` guarda el resto.
  El toggle de dueño-empleado usa `toggleOwnerAsEmployee()` y refresca plan y empleados.
- **Plan** (`PlanTab`): presenta el plan actual, el consumo de límites con doughnuts de
  Chart.js, el catálogo público, los códigos de activación y el historial. `SettingsStore`
  expone `plan`, `availablePlans`, `planHistory` y `changePlan()`.
- **Equipo** (`TeamTab`): lista invitaciones con su estado y permite crear, reenviar y
  cancelar. `SettingsStore` mantiene `invitations` y refresca la lista después de cada
  operación.

Las fechas se presentan con el pipe `dateFmt` y los precios con `CurrencyPipe` en COP. Todos
los formularios son presentacionales: reciben datos por `input`, emiten acciones por `output`
y dejan las peticiones HTTP en `SettingsStore`.

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
