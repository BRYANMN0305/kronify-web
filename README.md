# Kronify Web

Presentación del frontend de Kronify realizado con angular, junto a componentes standalone, signals y
`ChangeDetectionStrategy.OnPush`. La interfaz usa Bootstrap 5 (solo CSS: grid, utilidades,
formularios y botones); el CSS propio queda para tokens, temas y animaciones. La aplicación
cubre autenticación, invitaciones de equipo, onboarding, el shell de la zona autenticada, la
agenda de citas, el catálogo de servicios (listado, detalle y alta con formulario reactivo) y
la configuración completa de cuenta y negocio (datos, contraseña, perfil, plan con gráficas de
Chart.js y equipo).

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

| Ruta | Vista | Parámetro | Acceso y descripción |
| --- | --- | --- | --- |
| `/iniciar-sesion` | `AuthPage` | — | Público. Login con credenciales u OAuth |
| `/registro` | `AuthPage` | — | Público. Registro de cliente o negocio |
| `/oauth/callback` | `OAuthCallbackPage` | — | Público. Finalización del login OAuth |
| `/invitacion/aceptar` | `InvitationAcceptPage` | — | Público. Aceptación de invitaciones de empleado |
| `/onboarding-negocio` | `OnboardingBusinessPage` | — | Autenticado. Wizard de creación del negocio |
| `/calendario` | `CalendarPage` | — | Autenticado. Agenda de citas; destino posterior al login |
| `/servicios` | `ServicesPage` | — | Autenticado. Listado, búsqueda, alta y edición del catálogo |
| `/servicios/:id` | `ServiceDetailPage` | `id` (`number`, recibido con `input()`) | Autenticado. Detalle de un servicio por identificador |
| `/no-encontrado` | `NotFoundPage` | — | Público. Vista 404 explícita |
| `**` | `NotFoundPage` | — | Público. Cualquier ruta inexistente muestra la vista 404 |
| `/configuracion` | `SettingsPage` | — | Autenticado. Cuenta y negocio con todas las pestañas |

Las vistas del catálogo se cargan con `loadComponent` (carga diferida por ruta) y el detalle
recibe el `:id` como texto de la URL; `ServiceDetailPage` lo convierte a número con
`numberAttribute` mediante `input.required<number, string>()`. La ruta `servicios/:id` se
declara antes del comodín `**`, de modo que un identificador inexistente llega al detalle y
muestra “Servicio no encontrado”, mientras que una ruta desconocida cae en la vista 404.

## ¿Por qué el alta usa formulario reactivo?

El alta de servicios usa `FormBuilder.nonNullable.group` y no un formulario basado en
plantillas porque el estado del formulario, las validaciones y el botón de envío se
necesitan en el componente, no solo en la vista. Un formulario reactivo permite:

- **Tipado del modelo de formulario.** `ServiceFormValue` declara los cinco campos con sus
  tipos (`string` o `number`) y `nonNullable.group` elimina los `null` implícitos, de modo
  que la conversión al modelo de datos `ServiceRequest` es explícita y verificada por
  TypeScript.
- **Validación declarativa y reutilizable.** Las reglas `required`, `minLength`, `maxLength`,
  `min`, `max` y el validador propio `priceMultipleOf1000` viven en el control, no en
  atributos HTML dispersos. Así la misma regla se prueba y se mantiene en un solo lugar.
- **Estado observable para la interfaz.** `form.invalid`, `control.touched` y `control.dirty`
  permiten mostrar cada mensaje solo cuando el usuario interactuó con el campo y deshabilitar
  el envío mientras el formulario sea inválido, sin lógica manual de eventos `input`/`blur`.
- **Integración con el servicio.** El componente emite un `ServiceRequest` ya convertido por
  `output()`; la página decide si llama a `createService` o `updateService` y reinicia el
  formulario con `reset()`. Un formulario de plantilla acoplaría la vista al objeto de
  petición y dificultaría reutilizar el mismo formulario para alta y edición.

La búsqueda del listado también es reactiva: `FormControl.valueChanges` pasa por
`debounceTime(300)`, `distinctUntilChanged()` y `takeUntilDestroyed()`, y alimenta una señal
de la que depende el `computed` del catálogo filtrado. No queda ninguna suscripción abierta.

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
        │   ├── ServicesPage
        │   │   └── ServiceFormComponent
        │   ├── ServiceDetailPage
        │   ├── NotFoundPage
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
| `ServicesPage` | — | — | Listado, búsqueda con debounce, alta/edición y eliminación de servicios |
| `ServiceFormComponent` | `initial` (`ServiceResponse \| null`), `saving` | `save: ServiceRequest` | Formulario reactivo tipado con validadores y reinicio controlado por el padre |
| `ServiceDetailPage` | `id` (requerido, convertido desde el `:id` de la ruta) | — | Consulta el servicio y muestra “Servicio no encontrado” ante un 404 |
| `NotFoundPage` | — | — | Vista 404 para `/no-encontrado` y para el comodín `**` |
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
`/calendario` requiere autenticación y es el destino posterior al login. El modo demo se
conserva como `input` del componente para pruebas, pero ya no se publica como ruta.

## Servicios

`ServicesPage` consulta el catálogo con `ServiceControllerService` y lo presenta en tarjetas.
La búsqueda usa un `FormControl` reactivo: `valueChanges` pasa por `debounceTime(300)`,
`distinctUntilChanged()` y `takeUntilDestroyed()`, y el resultado se guarda en una señal
privada que alimenta el `computed` `filteredServices`. De este modo tres teclas seguidas
producen una sola filtración, 300 ms después de la última.

El alta y la edición comparten `ServiceFormComponent`, un formulario reactivo construido con
`FormBuilder.nonNullable.group`. Sus controles son `name`, `description`, `durationMinutes`,
`bufferMinutes` y `price`; combinan `required`, `minLength`, `maxLength`, `min`, `max` y el
validador propio `priceMultipleOf1000`. Los mensajes aparecen solo con `touched || dirty` y el
botón se deshabilita con `form.invalid || saving()`. Al emitir `save`, la página llama a
`createService` o `updateService`, recarga el listado sin cambiar de ruta y reinicia el
formulario con `reset()`.

El detalle vive en `/servicios/:id`. `ServiceDetailPage` recibe el identificador con
`input.required<number, string>({ transform: numberAttribute })`, consulta `getService(id)` y,
si el API responde 404, muestra “Servicio no encontrado” con un enlace de vuelta al listado.
Las rutas desconocidas y `/no-encontrado` muestran `NotFoundPage`.

La interfaz `Appointment` está en
`src/app/features/agenda/modelos/appointment.model.ts`; los ocho registros locales de respaldo
están en `src/app/features/agenda/datos/appointments.data.ts`. Son datos sintéticos para
evaluación, no citas reales.

La API documentada por el equipo está en
<https://kronify-apis.duckdns.org/swagger-ui/index.html#/>.
