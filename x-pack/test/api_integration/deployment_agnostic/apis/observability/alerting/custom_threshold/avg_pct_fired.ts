/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { omit } from 'lodash';
import { cleanup, generate, Dataset, PartialConfig } from '@kbn/data-forge';
import { Aggregators } from '@kbn/observability-plugin/common/custom_threshold_rule/types';
import { FIRED_ACTIONS_ID } from '@kbn/observability-plugin/server/lib/rules/custom_threshold/constants';
import { OBSERVABILITY_THRESHOLD_RULE_TYPE_ID } from '@kbn/rule-data-utils';
import { parseSearchParams } from '@kbn/share-plugin/common/url_service';
import { COMPARATORS } from '@kbn/alerting-comparators';
import { kbnTestConfig } from '@kbn/test';
import type { InternalRequestHeader, RoleCredentials } from '@kbn/ftr-common-functional-services';
import { DeploymentAgnosticFtrProviderContext } from '../../../../ftr_provider_context';
import { ISO_DATE_REGEX } from './constants';
import { ActionDocument, LogsExplorerLocatorParsedParams } from './types';

export default function ({ getService }: DeploymentAgnosticFtrProviderContext) {
  const esClient = getService('es');
  const samlAuth = getService('samlAuth');
  const supertestWithoutAuth = getService('supertestWithoutAuth');
  const esDeleteAllIndices = getService('esDeleteAllIndices');
  const alertingApi = getService('alertingApi');
  const dataViewApi = getService('dataViewApi');
  const logger = getService('log');
  const config = getService('config');
  const spacesService = getService('spaces');
  const isServerless = config.get('serverless');
  const expectedConsumer = isServerless ? 'observability' : 'logs';
  let roleAuthc: RoleCredentials;
  let internalReqHeader: InternalRequestHeader;

  describe('AVG - PCT - FIRED', () => {
    const CUSTOM_THRESHOLD_RULE_ALERT_INDEX = '.alerts-observability.threshold.alerts-default';
    const ALERT_ACTION_INDEX = 'alert-action-threshold';
    const DATA_VIEW_TITLE = 'kbn-data-forge-fake_hosts.fake_hosts-*';
    const DATA_VIEW_NAME = 'data-view-name';
    const DATA_VIEW_ID = 'data-view-id';
    const SPACE_ID = 'test-space';
    let dataForgeConfig: PartialConfig;
    let dataForgeIndices: string[];
    let actionId: string;
    let ruleId: string;
    let alertId: string;

    before(async () => {
      roleAuthc = await samlAuth.createM2mApiKeyWithRoleScope('admin');
      internalReqHeader = samlAuth.getInternalRequestHeader();
      dataForgeConfig = {
        schedule: [
          {
            template: 'good',
            start: 'now-15m',
            end: 'now+5m',
            metrics: [
              { name: 'system.cpu.user.pct', method: 'linear', start: 2.5, end: 2.5 },
              { name: 'system.cpu.total.pct', method: 'linear', start: 0.5, end: 0.5 },
            ],
          },
        ],
        indexing: {
          dataset: 'fake_hosts' as Dataset,
          eventsPerCycle: 1,
          interval: 10000,
          alignEventsToInterval: true,
        },
      };
      dataForgeIndices = await generate({ client: esClient, config: dataForgeConfig, logger });
      await alertingApi.waitForDocumentInIndex({ indexName: DATA_VIEW_TITLE, docCountTarget: 360 });
      await dataViewApi.create({
        name: DATA_VIEW_NAME,
        id: DATA_VIEW_ID,
        title: DATA_VIEW_TITLE,
        spaceId: SPACE_ID,
        roleAuthc,
      });
      await spacesService.create({
        id: SPACE_ID,
        name: 'Test Space',
        disabledFeatures: [],
        color: '#AABBCC',
      });
    });

    after(async () => {
      await supertestWithoutAuth
        .delete(`/api/alerting/rule/${ruleId}`)
        .set(roleAuthc.apiKeyHeader)
        .set(internalReqHeader);
      await supertestWithoutAuth
        .delete(`/api/actions/connector/${actionId}`)
        .set(roleAuthc.apiKeyHeader)
        .set(internalReqHeader);
      await esClient.deleteByQuery({
        index: CUSTOM_THRESHOLD_RULE_ALERT_INDEX,
        query: { term: { 'kibana.alert.rule.uuid': ruleId } },
        conflicts: 'proceed',
      });
      await esClient.deleteByQuery({
        index: '.kibana-event-log-*',
        query: { term: { 'rule.id': ruleId } },
        conflicts: 'proceed',
      });
      await dataViewApi.delete({
        id: DATA_VIEW_ID,
        spaceId: SPACE_ID,
        roleAuthc,
      });
      await esDeleteAllIndices([ALERT_ACTION_INDEX, ...dataForgeIndices]);
      await cleanup({ client: esClient, config: dataForgeConfig, logger });
      await samlAuth.invalidateM2mApiKeyWithRoleScope(roleAuthc);
      await spacesService.delete(SPACE_ID);
    });

    describe('Rule creation', () => {
      it('creates rule successfully', async () => {
        actionId = await alertingApi.createIndexConnector({
          roleAuthc,
          name: 'Index Connector: Threshold API test',
          indexName: ALERT_ACTION_INDEX,
          spaceId: SPACE_ID,
        });

        const createdRule = await alertingApi.createRule({
          roleAuthc,
          spaceId: SPACE_ID,
          tags: ['observability'],
          consumer: expectedConsumer,
          name: 'Threshold rule',
          ruleTypeId: OBSERVABILITY_THRESHOLD_RULE_TYPE_ID,
          params: {
            criteria: [
              {
                comparator: COMPARATORS.GREATER_THAN,
                threshold: [0.5],
                timeSize: 5,
                timeUnit: 'm',
                metrics: [
                  { name: 'A', field: 'system.cpu.user.pct', aggType: Aggregators.AVERAGE },
                ],
              },
            ],
            alertOnNoData: true,
            alertOnGroupDisappear: true,
            searchConfiguration: {
              query: {
                query: '',
                language: 'kuery',
              },
              index: DATA_VIEW_ID,
            },
          },
          actions: [
            {
              group: FIRED_ACTIONS_ID,
              id: actionId,
              params: {
                documents: [
                  {
                    ruleType: '{{rule.type}}',
                    alertDetailsUrl: '{{context.alertDetailsUrl}}',
                    reason: '{{context.reason}}',
                    value: '{{context.value}}',
                    host: '{{context.host}}',
                    viewInAppUrl: '{{context.viewInAppUrl}}',
                  },
                ],
              },
              frequency: {
                notify_when: 'onActionGroupChange',
                throttle: null,
                summary: false,
              },
            },
          ],
        });
        ruleId = createdRule.id;
        expect(ruleId).not.to.be(undefined);
      });

      it('should be active', async () => {
        const executionStatus = await alertingApi.waitForRuleStatus({
          roleAuthc,
          ruleId,
          expectedStatus: 'active',
          spaceId: SPACE_ID,
        });
        expect(executionStatus).to.be('active');
      });

      it('should find the created rule with correct information about the consumer', async () => {
        const match = await alertingApi.findInRules(roleAuthc, ruleId, SPACE_ID);
        expect(match).not.to.be(undefined);
        expect(match.consumer).to.be(expectedConsumer);
      });

      it('should set correct information in the alert document', async () => {
        const resp = await alertingApi.waitForAlertInIndex({
          indexName: CUSTOM_THRESHOLD_RULE_ALERT_INDEX,
          ruleId,
        });
        alertId = (resp.hits.hits[0]._source as any)['kibana.alert.uuid'];

        expect(resp.hits.hits[0]._source).property(
          'kibana.alert.rule.category',
          'Custom threshold'
        );
        expect(resp.hits.hits[0]._source).property('kibana.alert.rule.consumer', expectedConsumer);
        expect(resp.hits.hits[0]._source).property('kibana.alert.rule.name', 'Threshold rule');
        expect(resp.hits.hits[0]._source).property('kibana.alert.rule.producer', 'observability');
        expect(resp.hits.hits[0]._source).property('kibana.alert.rule.revision', 0);
        expect(resp.hits.hits[0]._source).property(
          'kibana.alert.rule.rule_type_id',
          'observability.rules.custom_threshold'
        );
        expect(resp.hits.hits[0]._source).property('kibana.alert.rule.uuid', ruleId);
        expect(resp.hits.hits[0]._source).property('kibana.space_ids').contain(SPACE_ID);
        expect(resp.hits.hits[0]._source)
          .property('kibana.alert.rule.tags')
          .contain('observability');
        expect(resp.hits.hits[0]._source).property(
          'kibana.alert.action_group',
          'custom_threshold.fired'
        );
        expect(resp.hits.hits[0]._source).property('tags').contain('observability');
        expect(resp.hits.hits[0]._source).property('kibana.alert.instance.id', '*');
        expect(resp.hits.hits[0]._source).property('kibana.alert.workflow_status', 'open');
        expect(resp.hits.hits[0]._source).property('event.kind', 'signal');
        expect(resp.hits.hits[0]._source).property('event.action', 'open');
        expect(resp.hits.hits[0]._source).property('kibana.alert.evaluation.threshold').eql([0.5]);
        expect(resp.hits.hits[0]._source)
          .property('kibana.alert.rule.parameters')
          .eql({
            criteria: [
              {
                comparator: '>',
                threshold: [0.5],
                timeSize: 5,
                timeUnit: 'm',
                metrics: [{ name: 'A', field: 'system.cpu.user.pct', aggType: 'avg' }],
              },
            ],
            alertOnNoData: true,
            alertOnGroupDisappear: true,
            searchConfiguration: { index: 'data-view-id', query: { query: '', language: 'kuery' } },
          });
      });

      it('should set correct action variables', async () => {
        const resp = await alertingApi.waitForDocumentInIndex<ActionDocument>({
          indexName: ALERT_ACTION_INDEX,
          docCountTarget: 1,
        });

        const { protocol, hostname, port } = kbnTestConfig.getUrlPartsWithStrippedDefaultPort();
        expect(resp.hits.hits[0]._source?.ruleType).eql('observability.rules.custom_threshold');
        expect(resp.hits.hits[0]._source?.alertDetailsUrl).eql(
          `${protocol}://${hostname}${
            port ? `:${port}` : ''
          }/s/${SPACE_ID}/app/observability/alerts/${alertId}`
        );
        expect(resp.hits.hits[0]._source?.reason).eql(
          `Average system.cpu.user.pct is 250%, above the threshold of 50%. (duration: 5 mins, data view: ${DATA_VIEW_NAME})`
        );
        expect(resp.hits.hits[0]._source?.value).eql('250%');

        const parsedViewInAppUrl = parseSearchParams<LogsExplorerLocatorParsedParams>(
          new URL(resp.hits.hits[0]._source?.viewInAppUrl || '').search
        );
        const viewInAppUrlPathName = new URL(resp.hits.hits[0]._source?.viewInAppUrl || '')
          .pathname;

        expect(viewInAppUrlPathName).contain(`/s/${SPACE_ID}/app/r`);

        expect(resp.hits.hits[0]._source?.viewInAppUrl).contain('LOGS_EXPLORER_LOCATOR');
        expect(omit(parsedViewInAppUrl.params, 'timeRange.from')).eql({
          dataset: DATA_VIEW_ID,
          timeRange: { to: 'now' },
          query: { query: '', language: 'kuery' },
          filters: [],
        });
        expect(parsedViewInAppUrl.params.timeRange.from).match(ISO_DATE_REGEX);
      });
    });
  });
}
