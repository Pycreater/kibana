/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { useEffect } from 'react';
import { useMemo } from 'react';
import { useLocation, useRouteMatch } from 'react-router-dom';

import { noop } from 'lodash/fp';

import { useGetSettings } from '../../../hooks';

import type { AddToPolicyParams, EditPackagePolicyFrom } from './types';

import { CreatePackagePolicySinglePage } from './single_page_layout';
import { CreatePackagePolicyMultiPage } from './multi_page_layout';
import { EmbeddedIntegrationFlow } from './embedded_integration_flow';

export const CreatePackagePolicyPage: React.FC<{
  useMultiPageLayoutProp?: boolean;
  originFrom?: EditPackagePolicyFrom;
  integrationName?: string;
  onStepNext?: (step: number) => void;
  onCancel?: () => void;
  handleViewAssets?: () => void;
}> = ({
  useMultiPageLayoutProp,
  originFrom,
  integrationName,
  onStepNext,
  onCancel = noop,
  handleViewAssets = noop,
}) => {
  const { search } = useLocation();
  const { params } = useRouteMatch<AddToPolicyParams>();
  const queryParams = useMemo(() => new URLSearchParams(search), [search]);
  const useMultiPageLayout = useMemo(
    () => useMultiPageLayoutProp ?? queryParams.has('useMultiPageLayout'),
    [queryParams, useMultiPageLayoutProp]
  );
  const queryParamsPolicyId = useMemo(
    () => queryParams.get('policyId') ?? undefined,
    [queryParams]
  );
  const [prerelease, setPrerelease] = React.useState<boolean>(false);

  const { data: settings } = useGetSettings();

  useEffect(() => {
    const isEnabled = Boolean(settings?.item.prerelease_integrations_enabled);
    if (settings?.item) {
      setPrerelease(isEnabled);
    }
  }, [settings?.item]);

  /**
   * Please note: policyId can come from one of two sources. The URL param (in the URL path) or
   * in the query params (?policyId=foo).
   *
   * Either way, we take this as an indication that a user is "coming from" the fleet policy UI
   * since we link them out to packages (a.k.a. integrations) UI when choosing a new package. It is
   * no longer possible to choose a package directly in the create package form.
   *
   * We may want to deprecate the ability to pass in policyId from URL params since there is no package
   * creation possible if a user has not chosen one from the packages UI.
   */
  const from: EditPackagePolicyFrom =
    originFrom ?? ('policyId' in params || queryParamsPolicyId ? 'policy' : 'package');

  const pageParams = {
    from,
    queryParamsPolicyId,
    prerelease,
  };

  if (from === 'onboarding-hub') {
    return (
      <EmbeddedIntegrationFlow
        {...pageParams}
        onCancel={onCancel}
        handleViewAssets={handleViewAssets}
        onStepNext={onStepNext}
        integrationName={integrationName}
      />
    );
  }

  if (useMultiPageLayout) {
    return <CreatePackagePolicyMultiPage {...pageParams} />;
  }

  return <CreatePackagePolicySinglePage {...pageParams} />;
};
