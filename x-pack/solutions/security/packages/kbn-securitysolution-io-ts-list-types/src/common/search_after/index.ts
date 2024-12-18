/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/* eslint-disable @typescript-eslint/naming-convention */

import * as t from 'io-ts';

export const search_after = t.array(t.string);
export type SearchAfter = t.TypeOf<typeof search_after>;

export const searchAfterOrUndefined = t.union([search_after, t.undefined]);
export type SearchAfterOrUndefined = t.TypeOf<typeof searchAfterOrUndefined>;
