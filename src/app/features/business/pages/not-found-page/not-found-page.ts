import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Vista 404 para cualquier ruta que no exista en la aplicación. */
@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found-page.html',
  styleUrl: './not-found-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {
  private readonly location = inject(Location);

  protected readonly attemptedPath = this.location.path();

  protected goBack(): void {
    this.location.back();
  }
}
