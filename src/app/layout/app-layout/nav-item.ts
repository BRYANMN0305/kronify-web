/** Item de navegación compartido entre Sidebar y BottomNav (contrato interno del shell) */
export interface NavItem {
  /** ruta absoluta de Angular */
  readonly path: string;
  readonly label: string;
  /** ruta pública del SVG en /images/icons */
  readonly icon: string;
}
