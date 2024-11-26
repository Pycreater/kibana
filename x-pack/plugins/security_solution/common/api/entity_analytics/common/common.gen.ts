/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * NOTICE: Do not edit this file manually.
 * This file is automatically generated by the OpenAPI Generator, @kbn/openapi-generator.
 *
 * info:
 *   title: Entity Analytics Common Schema
 *   version: 1
 */

import { z } from '@kbn/zod';

import { AssetCriticalityLevel } from '../asset_criticality/common.gen';

export type EntityAnalyticsPrivileges = z.infer<typeof EntityAnalyticsPrivileges>;
export const EntityAnalyticsPrivileges = z.object({
  has_all_required: z.boolean(),
  has_read_permissions: z.boolean().optional(),
  has_write_permissions: z.boolean().optional(),
  privileges: z.object({
    elasticsearch: z.object({
      cluster: z.object({}).catchall(z.boolean()).optional(),
      index: z.object({}).catchall(z.object({}).catchall(z.boolean())).optional(),
    }),
    kibana: z.object({}).catchall(z.boolean()).optional(),
  }),
});

export type EntityAfterKey = z.infer<typeof EntityAfterKey>;
export const EntityAfterKey = z.object({}).catchall(z.string());

export type AfterKeys = z.infer<typeof AfterKeys>;
export const AfterKeys = z.object({
  host: EntityAfterKey.optional(),
  user: EntityAfterKey.optional(),
});

/**
 * The identifier of the Kibana data view to be used when generating risk scores.
 */
export type DataViewId = z.infer<typeof DataViewId>;
export const DataViewId = z.string();

/**
 * An elasticsearch DSL filter object. Used to filter the risk inputs involved, which implicitly filters the risk scores themselves.
 */
export type Filter = z.infer<typeof Filter>;
export const Filter = z.object({}).catchall(z.unknown());

/**
 * Specifies how many scores will be involved in a given calculation. Note that this value is per `identifier_type`, i.e. a value of 10 will calculate 10 host scores and 10 user scores, if available. To avoid missed data, keep this value consistent while paginating through scores.
 */
export type PageSize = z.infer<typeof PageSize>;
export const PageSize = z.number().default(1000);

export type KibanaDate = z.infer<typeof KibanaDate>;
export const KibanaDate = z.string();

/**
 * Defines the time period on which risk inputs will be filtered.
 */
export type DateRange = z.infer<typeof DateRange>;
export const DateRange = z.object({
  start: KibanaDate,
  end: KibanaDate,
});

export type IdentifierType = z.infer<typeof IdentifierType>;
export const IdentifierType = z.enum(['host', 'user']);
export type IdentifierTypeEnum = typeof IdentifierType.enum;
export const IdentifierTypeEnum = IdentifierType.enum;

/**
 * A generic representation of a document contributing to a Risk Score.
 */
export type RiskScoreInput = z.infer<typeof RiskScoreInput>;
export const RiskScoreInput = z.object({
  /**
   * The unique identifier (`_id`) of the original source document
   */
  id: z.string(),
  /**
   * The unique index (`_index`) of the original source document
   */
  index: z.string(),
  /**
   * The risk category of the risk input document.
   */
  category: z.string(),
  /**
   * A human-readable description of the risk input document.
   */
  description: z.string(),
  /**
   * The weighted risk score of the risk input document.
   */
  risk_score: z.number().min(0).max(100).optional(),
  /**
   * The @timestamp of the risk input document.
   */
  timestamp: z.string().optional(),
  contribution_score: z.number().optional(),
});

export type RiskScoreCategories = z.infer<typeof RiskScoreCategories>;
export const RiskScoreCategories = z.literal('category_1');

export type EntityRiskLevels = z.infer<typeof EntityRiskLevels>;
export const EntityRiskLevels = z.enum(['Unknown', 'Low', 'Moderate', 'High', 'Critical']);
export type EntityRiskLevelsEnum = typeof EntityRiskLevels.enum;
export const EntityRiskLevelsEnum = EntityRiskLevels.enum;

export type EntityRiskScoreRecord = z.infer<typeof EntityRiskScoreRecord>;
export const EntityRiskScoreRecord = z.object({
  /**
   * The time at which the risk score was calculated.
   */
  '@timestamp': z.string().datetime(),
  /**
   * The identifier field defining this risk score. Coupled with `id_value`, uniquely identifies the entity being scored.
   */
  id_field: z.string(),
  /**
   * The identifier value defining this risk score. Coupled with `id_field`, uniquely identifies the entity being scored.
   */
  id_value: z.string(),
  /**
   * Lexical description of the entity's risk.
   */
  calculated_level: EntityRiskLevels,
  /**
   * The raw numeric value of the given entity's risk score.
   */
  calculated_score: z.number(),
  /**
   * The normalized numeric value of the given entity's risk score. Useful for comparing with other entities.
   */
  calculated_score_norm: z.number().min(0).max(100),
  /**
   * The contribution of Category 1 to the overall risk score (`calculated_score`). Category 1 contains Detection Engine Alerts.
   */
  category_1_score: z.number(),
  /**
   * The number of risk input documents that contributed to the Category 1 score (`category_1_score`).
   */
  category_1_count: z.number(),
  /**
   * A list of the highest-risk documents contributing to this risk score. Useful for investigative purposes.
   */
  inputs: z.array(RiskScoreInput),
  category_2_score: z.number().optional(),
  category_2_count: z.number().optional(),
  notes: z.array(z.string()),
  criticality_modifier: z.number().optional(),
  criticality_level: AssetCriticalityLevel.optional(),
});

export type RiskScoreEntityIdentifierWeights = z.infer<typeof RiskScoreEntityIdentifierWeights>;
export const RiskScoreEntityIdentifierWeights = z.number().min(0).max(1);

export type RiskScoreWeightGlobalShared = z.infer<typeof RiskScoreWeightGlobalShared>;
export const RiskScoreWeightGlobalShared = z.object({
  type: z.literal('global_identifier'),
});

export type RiskScoreWeight = z.infer<typeof RiskScoreWeight>;
export const RiskScoreWeight = z.union([
  RiskScoreWeightGlobalShared.merge(
    z.object({
      host: RiskScoreEntityIdentifierWeights,
      user: RiskScoreEntityIdentifierWeights.optional(),
    })
  ),
  RiskScoreWeightGlobalShared.merge(
    z.object({
      host: RiskScoreEntityIdentifierWeights.optional(),
      user: RiskScoreEntityIdentifierWeights,
    })
  ),
]);

/**
 * A list of weights to be applied to the scoring calculation.
 */
export type RiskScoreWeights = z.infer<typeof RiskScoreWeights>;
export const RiskScoreWeights = z.array(RiskScoreWeight);

/**
 * Task manager is unavailable
 */
export type TaskManagerUnavailableResponse = z.infer<typeof TaskManagerUnavailableResponse>;
export const TaskManagerUnavailableResponse = z.object({
  status_code: z.number().int().min(400),
  message: z.string(),
});
