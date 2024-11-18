/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';

import { EuiFlexItem, EuiFlexGroup, EuiProgress } from '@elastic/eui';
import { SECURITY_SOLUTION_RULE_TYPE_IDS } from '@kbn/securitysolution-rules';
import { SECURITY_SOLUTION_OWNER } from '../../../../common/constants';
import type { CaseUI } from '../../../../common';
import { useKibana } from '../../../common/lib/kibana';
import { getManualAlertIds } from './helpers';
import { useGetFeatureIds } from '../../../containers/use_get_feature_ids';
import { CaseViewAlertsEmpty } from './case_view_alerts_empty';
import { CaseViewTabs } from '../case_view_tabs';
import { CASE_VIEW_PAGE_TABS } from '../../../../common/types';

interface CaseViewAlertsProps {
  caseData: CaseUI;
  onAlertsTableLoaded?: (eventIds: Array<Partial<{ _id: string }>>) => void;
}

export const CaseViewAlerts = ({ caseData, onAlertsTableLoaded }: CaseViewAlertsProps) => {
  const {
    triggersActionsUi: { getAlertsStateTable: AlertsTable },
  } = useKibana().services;

  const alertIds = getManualAlertIds(caseData.comments);
  const alertIdsQuery = useMemo(
    () => ({
      ids: {
        values: alertIds,
      },
    }),
    [alertIds]
  );

  const { isLoading: isLoadingAlertFeatureIds, data: alertData } = useGetFeatureIds(
    alertIds,
    caseData.owner !== SECURITY_SOLUTION_OWNER
  );

  if (alertIdsQuery.ids.values.length === 0) {
    return (
      <EuiFlexGroup>
        <EuiFlexItem>
          <CaseViewTabs caseData={caseData} activeTab={CASE_VIEW_PAGE_TABS.ALERTS} />
          <CaseViewAlertsEmpty />
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  return isLoadingAlertFeatureIds ? (
    <EuiFlexGroup>
      <EuiFlexItem>
        <EuiProgress size="xs" color="primary" />
      </EuiFlexItem>
    </EuiFlexGroup>
  ) : (
    <EuiFlexItem data-test-subj="case-view-alerts">
      <CaseViewTabs caseData={caseData} activeTab={CASE_VIEW_PAGE_TABS.ALERTS} />
      <AlertsTable
        id={`case-details-alerts-${caseData.owner}`}
        ruleTypeIds={
          caseData.owner === SECURITY_SOLUTION_OWNER
            ? SECURITY_SOLUTION_RULE_TYPE_IDS
            : alertData?.ruleTypeIds ?? []
        }
        consumers={alertData?.featureIds}
        query={alertIdsQuery}
        showAlertStatusWithFlapping={caseData.owner !== SECURITY_SOLUTION_OWNER}
        onLoaded={onAlertsTableLoaded}
      />
    </EuiFlexItem>
  );
};
CaseViewAlerts.displayName = 'CaseViewAlerts';
