import { ChangeDetectionStrategy, Component } from '@angular/core';

const MAIN_WEBSITE_URL = 'https://kronify.page.gd/';

/** Botón que devuelve a la página pública principal. */
@Component({
  selector: 'app-back-to-website-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="back-to-website">
      <a class="btn-back" [href]="mainUrl" aria-label="Volver al sitio principal">
        <img src="/images/auth/arrow.svg" alt="back to main website" width="18" height="18"/>
      </a>
    </div>
  `,
  styles: `
    .back-to-website {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .btn-back {
      display: inline-flex;
      align-items: center;
      background: var(--acero-3);
      border: 1px solid var(--color-border-hover);
      border-radius: var(--radius-sm);
      color: var(--color-text);
      font-size: var(--text-base);
      padding: 0.3rem 0.3rem;
      transition: all 0.2s;
      opacity: 50%;
      text-decoration: none;
    }

    .btn-back:hover {
      opacity: 100%;
    }
  `,
})
export class BackToWebsiteButton {
  protected readonly mainUrl = MAIN_WEBSITE_URL;
}
