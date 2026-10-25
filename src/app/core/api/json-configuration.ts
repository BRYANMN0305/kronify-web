import { Configuration, ConfigurationParameters } from './openapi/configuration';

/** Ajusta el cliente generado para aceptar una respuesta JSON aunque el API no detalle su tipo MIME. */
export class JsonConfiguration extends Configuration {
  constructor(parameters?: ConfigurationParameters) {
    super(parameters);
  }

  override isJsonMime(mime: string): boolean {
    return mime === '*/*' || super.isJsonMime(mime);
  }
}
