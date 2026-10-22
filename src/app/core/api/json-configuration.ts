import { Configuration, ConfigurationParameters } from './openapi/configuration';

export class JsonConfiguration extends Configuration {
  constructor(parameters?: ConfigurationParameters) {
    super(parameters);
  }

  override isJsonMime(mime: string): boolean {
    return mime === '*/*' || super.isJsonMime(mime);
  }
}
