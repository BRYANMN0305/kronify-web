import { BusinessCreateResponse, BusinessSettingsResponse } from '../api/openapi/model/models';

/** Representación del negocio en el store — según el endpoint que lo devolvió */
export type Business = BusinessSettingsResponse | BusinessCreateResponse;
