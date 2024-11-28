/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { services as kibanaApiIntegrationServices } from '@kbn/test-suites-src/api_integration/services';
import { commonFunctionalServices } from '@kbn/ftr-common-functional-services';
import { commonFunctionalUIServices } from '@kbn/ftr-common-functional-ui-services';
import { InfraLogViewsServiceProvider } from './infra_log_views';
import { SpacesServiceProvider } from './spaces';
import { SearchSecureService } from './search_secure';
import { ApmSynthtraceKibanaClientProvider } from './apm_synthtrace_kibana_client';
import { InfraSynthtraceKibanaClientProvider } from './infra_synthtrace_kibana_client';

export const services = {
  ...commonFunctionalServices,
  ...commonFunctionalUIServices,
  infraLogViews: InfraLogViewsServiceProvider,
  supertest: kibanaApiIntegrationServices.supertest,
  spaces: SpacesServiceProvider,
  secureSearch: SearchSecureService,
  apmSynthtraceKibanaClient: ApmSynthtraceKibanaClientProvider,
  infraSynthtraceKibanaClient: InfraSynthtraceKibanaClientProvider,
};
