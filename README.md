# Kronify · Entrega 1 (Grupo 4)

## Integrantes y dominio

- Iglesias Movilla Iryuris
- Muñoz Zambrano Bryan Manuel

Kronify es una SPA para negocios de belleza. El flujo de producto incluye autenticación y registro de cuentas, acceso mediante correo y contraseña o proveedores OAuth (Google/Microsoft), y la gestión de agenda. La vista principal de esta entrega es el calendario de citas. Su entidad central es `Appointment` (cita), con cliente, servicio, empleado, fecha/hora, duración, precio y estado.

## Ejecutar

Requiere Node.js compatible con Angular CLI del proyecto y npm.

```bash
npm install
npm start
```

Abra `http://localhost:4200/calendario`. La vista intenta consultar la API cuando hay sesión y muestra registros locales claramente marcados si no hay sesión o falla la carga. `http://localhost:4200/demo-calendario` fuerza los datos locales para revisar el prototipo.

Compilación requerida para entrega: `npx ng build`.

## Árbol de componentes de agenda

```text
Rutas públicas
├── /iniciar-sesion ─┐
├── /registro ───────┴── AuthLayout > AuthPage > LoginForm | RegisterForm > OAuthButtons
└── /oauth/callback ─── OAuthCallbackPage > AuthLayout

AppLayout (shell de áreas autenticadas y modo de evaluación)
├── AgendaStateHeader (lector externo del estado compartido)
└── AgendaPage (vista calendario y coordinación de filtros/selección)
    ├── AgendaSummary (indicadores derivados de la agenda)
    ├── CalendarGrid (mes y selección del día)
    └── AppointmentRow (repetido por cita y acción de confirmar)
```

## Contratos

| Componente | Inputs | Outputs | Estado que usa |
| --- | --- | --- | --- |
| `AgendaPage` | `demoMode` (opcional) | — | `AgendaStore`; coordina carga, filtros, día y mes |
| `AgendaStateHeader` | — | — | Lee `confirmedCount`, `appointmentCount` e `isDemo` de `AgendaStore` desde el shell |
| `CalendarGrid` | `weeks` requerido; `selectedKey` requerido | `daySelected: Date` | No posee estado; recibe datos del padre |
| `AppointmentRow` | `appointment` requerido | `statusChange: AppointmentStatus` | No posee estado; comunica la intención al padre |
| `AgendaSummary` | `confirmed`, `total`, `revenue` requeridos | — | Presentacional; recibe valores derivados del padre |
| `LoginForm` | `loading`, `errorMessage`, `oauthRedirecting` | `login`, `switchToRegister`, `oauth` | Presentacional; `AuthPage` coordina con `AuthStore` |
| `RegisterForm` | `loading`, `errorMessage`, `oauthRedirecting` | `register`, `switchToLogin`, `oauth` | Presentacional; `AuthPage` coordina registro y selección de perfil |
| `OAuthButtons` | `disabled` | `oauth` | Emite proveedor; `AuthStore` prepara la URL de autorización |

## Servicio y propiedad del estado

`AgendaStore` (`@Injectable({ providedIn: 'root' })`) es dueño del listado de citas, carga, error y modo demo porque calendario, resumen y filas necesitan una única fuente coherente. Mantiene signals privadas, expone lectores `asReadonly()`, y cambia datos mediante `loadDemo`, `loadRange` y `updateStatus`. `appointmentCount`, `confirmedCount` e `todayRevenue` son `computed` y la página los muestra en `AgendaSummary`. La fila hija no muta el estado: emite `statusChange` y el padre delega al servicio.

`AuthStore` es dueño de la sesión, usuario derivado de los claims, carga y error de autenticación. `LoginForm` y `RegisterForm` emiten sus datos a `AuthPage`; el store llama los endpoints de autenticación, conserva el token por medio de `TokenStorage` y actualiza estado de sesión. El callback procesa el retorno OAuth y luego la navegación posterior resuelve el destino según el perfil.

## Modelo y datos

La interfaz está en `src/app/features/agenda/modelos/appointment.model.ts`; los ocho registros locales de respaldo están en `src/app/features/agenda/datos/appointments.data.ts`. Son datos sintéticos para evaluación, no citas reales. La API documentada por el equipo está en <https://kronify-apis.duckdns.org/swagger-ui/index.html#/>.

## Pendiente de validar en el equipo

Verificar los autores de Git (`BRYANMN0305` y `Bryan Muñoz` aparecen como identidades distintas en el historial) antes de transcribir el shortlog definitivo.
