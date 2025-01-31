/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback, useMemo, useState } from 'react';
import type { IdFormat, JobType } from '../../../../common/http_api/latest';
import { getJobId } from '../../../../common/log_analysis';
import { useKibanaContextForPlugin } from '../../../hooks/use_kibana';
import { useTrackedPromise } from '../../../hooks/use_tracked_promise';
import type { JobSummary } from './api/ml_get_jobs_summary_api';
import type { GetMlModuleResponsePayload, JobDefinition } from './api/ml_get_module';
import type { ModuleDescriptor, ModuleSourceConfiguration } from './log_analysis_module_types';

export const useLogAnalysisModuleDefinition = <T extends JobType>({
  sourceConfiguration: { spaceId, sourceId },
  idFormat,
  moduleDescriptor,
}: {
  sourceConfiguration: ModuleSourceConfiguration;
  idFormat: IdFormat;
  moduleDescriptor: ModuleDescriptor<T>;
}) => {
  const { services } = useKibanaContextForPlugin();
  const [moduleDefinition, setModuleDefinition] = useState<
    GetMlModuleResponsePayload | undefined
  >();

  const jobDefinitionByJobId = useMemo(
    () =>
      moduleDefinition
        ? moduleDefinition.jobs.reduce<Record<string, JobDefinition>>(
            (accumulatedJobDefinitions, jobDefinition) => ({
              ...accumulatedJobDefinitions,
              [getJobId(spaceId, sourceId, idFormat, jobDefinition.id as T)]: jobDefinition,
            }),
            {}
          )
        : {},
    [moduleDefinition, sourceId, spaceId, idFormat]
  );

  const [fetchModuleDefinitionRequest, fetchModuleDefinition] = useTrackedPromise(
    {
      cancelPreviousOn: 'resolution',
      createPromise: async () => {
        return await moduleDescriptor.getModuleDefinition(services.http.fetch);
      },
      onResolve: (response) => {
        setModuleDefinition(response);
      },
      onReject: () => {
        setModuleDefinition(undefined);
      },
    },
    [moduleDescriptor.getModuleDefinition, spaceId, sourceId]
  );

  const getIsJobDefinitionOutdated = useCallback(
    (jobSummary: JobSummary): boolean => {
      const jobDefinition: JobDefinition | undefined = jobDefinitionByJobId[jobSummary.id];

      if (jobDefinition == null) {
        return false;
      }

      const currentRevision = jobDefinition?.config.custom_settings.job_revision;
      return (jobSummary.fullJob?.custom_settings?.job_revision ?? 0) < (currentRevision ?? 0);
    },
    [jobDefinitionByJobId]
  );

  return {
    fetchModuleDefinition,
    fetchModuleDefinitionRequestState: fetchModuleDefinitionRequest.state,
    getIsJobDefinitionOutdated,
    jobDefinitionByJobId,
    moduleDefinition,
  };
};
