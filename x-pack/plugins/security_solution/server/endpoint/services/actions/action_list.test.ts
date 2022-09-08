/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClientMock } from '@kbn/core/server/mocks';
import { elasticsearchServiceMock, loggingSystemMock } from '@kbn/core/server/mocks';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import type {
  EndpointActionResponse,
  LogsEndpointAction,
  LogsEndpointActionResponse,
} from '../../../../common/endpoint/types';
import { EndpointActionGenerator } from '../../../../common/endpoint/data_generators/endpoint_action_generator';
import { getActionList } from './action_list';
import { CustomHttpRequestError } from '../../../utils/custom_http_request_error';
import {
  applyActionListEsSearchMock,
  createActionRequestsEsSearchResultsMock,
  createActionResponsesEsSearchResultsMock,
} from './mocks';
import type { MockedLogger } from '@kbn/logging-mocks';
import { EndpointAppContextService } from '../../endpoint_app_context_services';
import {
  createMockEndpointAppContextServiceSetupContract,
  createMockEndpointAppContextServiceStartContract,
} from '../../mocks';

describe('When using `getActionList()', () => {
  let esClient: ElasticsearchClientMock;
  let logger: MockedLogger;
  let endpointActionGenerator: EndpointActionGenerator;
  let actionRequests: estypes.SearchResponse<LogsEndpointAction>;
  let actionResponses: estypes.SearchResponse<EndpointActionResponse | LogsEndpointActionResponse>;
  let endpointAppContextService: EndpointAppContextService;

  beforeEach(() => {
    esClient = elasticsearchServiceMock.createScopedClusterClient().asInternalUser;
    logger = loggingSystemMock.createLogger();
    endpointActionGenerator = new EndpointActionGenerator('seed');
    endpointAppContextService = new EndpointAppContextService();
    endpointAppContextService.setup(createMockEndpointAppContextServiceSetupContract());
    endpointAppContextService.start(createMockEndpointAppContextServiceStartContract());

    actionRequests = createActionRequestsEsSearchResultsMock();
    actionResponses = createActionResponsesEsSearchResultsMock();

    applyActionListEsSearchMock(esClient, actionRequests, actionResponses);
  });

  afterEach(() => {
    endpointAppContextService.stop();
  });

  it('should return expected output', async () => {
    const doc = actionRequests.hits.hits[0]._source;
    // mock metadataService.findHostMetadataForFleetAgents resolved value
    (endpointAppContextService.getEndpointMetadataService as jest.Mock) = jest
      .fn()
      .mockReturnValue({
        findHostMetadataForFleetAgents: jest.fn().mockResolvedValue([
          {
            agent: {
              id: 'agent-a',
            },
            host: {
              hostname: 'Host-agent-a',
            },
          },
        ]),
      });
    await expect(
      getActionList({
        esClient,
        logger,
        metadataService: endpointAppContextService.getEndpointMetadataService(),
        page: 1,
        pageSize: 10,
      })
    ).resolves.toEqual({
      page: 1,
      pageSize: 10,
      commands: undefined,
      userIds: undefined,
      startDate: undefined,
      elasticAgentIds: undefined,
      endDate: undefined,
      data: [
        {
          agents: ['agent-a'],
          hosts: { 'agent-a': { name: 'Host-agent-a' } },
          command: 'unisolate',
          completedAt: '2022-04-30T16:08:47.449Z',
          wasSuccessful: true,
          errors: undefined,
          id: '123',
          isCompleted: true,
          isExpired: false,
          startedAt: '2022-04-27T16:08:47.449Z',
          comment: doc?.EndpointActions.data.comment,
          createdBy: doc?.user.id,
          parameters: doc?.EndpointActions.data.parameters,
          agentState: {
            'agent-a': {
              completedAt: '2022-04-30T16:08:47.449Z',
              isCompleted: true,
              wasSuccessful: true,
            },
          },
        },
      ],
      total: 1,
    });
  });

  it('should return expected output for multiple agent ids', async () => {
    const agentIds = ['agent-a', 'agent-b', 'agent-x'];
    actionRequests = createActionRequestsEsSearchResultsMock(agentIds);
    actionResponses = createActionResponsesEsSearchResultsMock(agentIds);

    applyActionListEsSearchMock(esClient, actionRequests, actionResponses);
    const doc = actionRequests.hits.hits[0]._source;
    // mock metadataService.findHostMetadataForFleetAgents resolved value
    (endpointAppContextService.getEndpointMetadataService as jest.Mock) = jest
      .fn()
      .mockReturnValue({
        findHostMetadataForFleetAgents: jest.fn().mockResolvedValue([
          {
            agent: {
              id: 'agent-a',
            },
            host: {
              hostname: 'Host-agent-a',
            },
          },
          {
            agent: {
              id: 'agent-b',
            },
            host: {
              hostname: 'Host-agent-b',
            },
          },
        ]),
      });
    await expect(
      getActionList({
        esClient,
        logger,
        metadataService: endpointAppContextService.getEndpointMetadataService(),
        page: 1,
        pageSize: 10,
      })
    ).resolves.toEqual({
      page: 1,
      pageSize: 10,
      commands: undefined,
      userIds: undefined,
      startDate: undefined,
      elasticAgentIds: undefined,
      endDate: undefined,
      data: [
        {
          agents: ['agent-a', 'agent-b', 'agent-x'],
          hosts: {
            'agent-a': { name: 'Host-agent-a' },
            'agent-b': { name: 'Host-agent-b' },
            'agent-x': { name: '' },
          },
          command: 'unisolate',
          completedAt: undefined,
          wasSuccessful: false,
          errors: undefined,
          id: '123',
          isCompleted: false,
          isExpired: true,
          startedAt: '2022-04-27T16:08:47.449Z',
          comment: doc?.EndpointActions.data.comment,
          createdBy: doc?.user.id,
          parameters: doc?.EndpointActions.data.parameters,
          agentState: {
            'agent-a': {
              completedAt: '2022-04-30T16:08:47.449Z',
              isCompleted: true,
              wasSuccessful: true,
              errors: undefined,
            },
            'agent-b': {
              completedAt: undefined,
              isCompleted: false,
              wasSuccessful: false,
              errors: undefined,
            },
            'agent-x': {
              completedAt: undefined,
              isCompleted: false,
              wasSuccessful: false,
              errors: undefined,
            },
          },
        },
      ],
      total: 1,
    });
  });

  it('should call query with expected filters when querying for Action Request', async () => {
    // mock metadataService.findHostMetadataForFleetAgents resolved value
    (endpointAppContextService.getEndpointMetadataService as jest.Mock) = jest
      .fn()
      .mockReturnValue({
        findHostMetadataForFleetAgents: jest.fn().mockResolvedValue([]),
      });
    await getActionList({
      esClient,
      logger,
      metadataService: endpointAppContextService.getEndpointMetadataService(),
      elasticAgentIds: ['123'],
      pageSize: 20,
      startDate: 'now-10d',
      endDate: 'now',
      commands: ['isolate', 'unisolate', 'get-file'],
      userIds: ['elastic'],
    });

    expect(esClient.search).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        body: {
          query: {
            bool: {
              filter: [
                {
                  term: {
                    input_type: 'endpoint',
                  },
                },
                {
                  term: {
                    type: 'INPUT_ACTION',
                  },
                },
                {
                  range: {
                    '@timestamp': {
                      gte: 'now-10d',
                    },
                  },
                },
                {
                  range: {
                    '@timestamp': {
                      lte: 'now',
                    },
                  },
                },
                {
                  terms: {
                    'data.command': ['isolate', 'unisolate', 'get-file'],
                  },
                },
                {
                  terms: {
                    user_id: ['elastic'],
                  },
                },
                {
                  terms: {
                    agents: ['123'],
                  },
                },
              ],
            },
          },
          sort: [
            {
              '@timestamp': {
                order: 'desc',
              },
            },
          ],
        },
        from: 0,
        index: '.logs-endpoint.actions-default',
        size: 20,
      }),
      expect.objectContaining({
        ignore: [404],
        meta: true,
      })
    );
  });

  it('should return an empty array if no actions are found', async () => {
    // mock metadataService.findHostMetadataForFleetAgents resolved value
    (endpointAppContextService.getEndpointMetadataService as jest.Mock) = jest
      .fn()
      .mockReturnValue({
        findHostMetadataForFleetAgents: jest.fn().mockResolvedValue([]),
      });
    actionRequests.hits.hits = [];
    (actionRequests.hits.total as estypes.SearchTotalHits).value = 0;
    (actionResponses.hits.total as estypes.SearchTotalHits).value = 0;
    actionRequests = endpointActionGenerator.toEsSearchResponse([]);

    await expect(
      getActionList({
        esClient,
        logger,
        metadataService: endpointAppContextService.getEndpointMetadataService(),
      })
    ).resolves.toEqual(
      expect.objectContaining({
        commands: undefined,
        data: [],
        elasticAgentIds: undefined,
        endDate: undefined,
        page: 1,
        pageSize: 10,
        startDate: undefined,
        total: 0,
        userIds: undefined,
      })
    );
  });

  it('should have `isExpired` as `true` if NOT complete and expiration is in the past', async () => {
    // mock metadataService.findHostMetadataForFleetAgents resolved value
    (endpointAppContextService.getEndpointMetadataService as jest.Mock) = jest
      .fn()
      .mockReturnValue({
        findHostMetadataForFleetAgents: jest.fn().mockResolvedValue([]),
      });
    (
      actionRequests.hits.hits[0]._source as LogsEndpointAction
    ).EndpointActions.expiration = `2021-04-30T16:08:47.449Z`;
    actionResponses.hits.hits.pop(); // remove the endpoint response

    await expect(
      await (
        await getActionList({
          esClient,
          logger,
          metadataService: endpointAppContextService.getEndpointMetadataService(),
          elasticAgentIds: ['123'],
        })
      ).data[0]
    ).toEqual(
      expect.objectContaining({
        isExpired: true,
        isCompleted: false,
      })
    );
  });

  it('should have `isExpired` as `false` if complete and expiration is in the past', async () => {
    // mock metadataService.findHostMetadataForFleetAgents resolved value
    (endpointAppContextService.getEndpointMetadataService as jest.Mock) = jest
      .fn()
      .mockReturnValue({
        findHostMetadataForFleetAgents: jest.fn().mockResolvedValue([]),
      });
    (
      actionRequests.hits.hits[0]._source as LogsEndpointAction
    ).EndpointActions.expiration = `2021-04-30T16:08:47.449Z`;

    await expect(
      await (
        await getActionList({
          esClient,
          logger,
          metadataService: endpointAppContextService.getEndpointMetadataService(),
          elasticAgentIds: ['123'],
        })
      ).data[0]
    ).toEqual(
      expect.objectContaining({
        isExpired: false,
        isCompleted: true,
      })
    );
  });

  it('should throw custom errors', async () => {
    // mock metadataService.findHostMetadataForFleetAgents resolved value
    (endpointAppContextService.getEndpointMetadataService as jest.Mock) = jest
      .fn()
      .mockReturnValue({
        findHostMetadataForFleetAgents: jest.fn().mockResolvedValue([]),
      });
    const error = new Error('Some odd error!');

    esClient.search.mockImplementation(async () => {
      return Promise.reject(error);
    });
    const getActionListPromise = getActionList({
      esClient,
      logger,
      metadataService: endpointAppContextService.getEndpointMetadataService(),
    });

    await expect(getActionListPromise).rejects.toThrowError(
      'Unknown error while fetching action requests'
    );
    await expect(getActionListPromise).rejects.toBeInstanceOf(CustomHttpRequestError);
  });
});
