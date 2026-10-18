import { Component } from '@angular/core';

const MAIN_WEBSITE_URL = 'https://kronify.page.gd/';

/** Botón "volver al sitio principal" (fix del typo BackToWebsiteButtom del proyecto Vue). */
@Component({
  selector: 'app-back-to-website-button',
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
      border-radius: 8px;
      color: var(--color-text);
      font-size: 0.8rem;
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
