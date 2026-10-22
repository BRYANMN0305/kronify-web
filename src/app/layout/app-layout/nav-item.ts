import type { IconName } from '../../shared/ui/icon/icon';

/** Item de navegación compartido entre Sidebar y BottomNav (contrato interno del shell) */
export interface NavItem {
  /** ruta absoluta de Angular */
  readonly path: string;
  readonly label: string;
  /** nombre del icono inline */
  readonly icon: IconName;
}
