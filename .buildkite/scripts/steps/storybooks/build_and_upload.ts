/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getKibanaDir } from '#pipeline-utils';

// TODO - how to generate this dynamically?
const STORYBOOKS = [
  'apm',
  'canvas',
  'cases',
  'cell_actions',
  'chart_icons',
  'cloud_security_posture_packages',
  'coloring',
  'content_management_examples',
  'custom_integrations',
  'dashboard_enhanced',
  'dashboard',
  'data',
  'esql_editor',
  'expression_error',
  'expression_image',
  'expression_metric',
  'expression_repeat_image',
  'expression_reveal_image',
  'expression_shape',
  'expression_tagcloud',
  'fleet',
  'grouping',
  'home',
  'infra',
  'kibana_react',
  'language_documentation_popover',
  'lists',
  'logs_explorer',
  'management',
  'observability_ai_assistant',
  'observability_shared',
  'observability',
  'presentation',
  'random_sampling',
  'security_solution_packages',
  'security_solution',
  'serverless',
  'shared_ux',
  'triggers_actions_ui',
  'ui_actions_enhanced',
  'unified_search',
];

const GITHUB_CONTEXT = 'Build and Publish Storybooks';

const STORYBOOK_DIRECTORY =
  process.env.BUILDKITE_PULL_REQUEST && process.env.BUILDKITE_PULL_REQUEST !== 'false'
    ? `pr-${process.env.BUILDKITE_PULL_REQUEST}`
    : (process.env.BUILDKITE_BRANCH ?? '').replace('/', '__');
const STORYBOOK_BUCKET = 'ci-artifacts.kibana.dev/storybooks';
const STORYBOOK_BUCKET_URL = `https://${STORYBOOK_BUCKET}/${STORYBOOK_DIRECTORY}`;
const STORYBOOK_BASE_URL = `${STORYBOOK_BUCKET_URL}/${process.env.BUILDKITE_COMMIT}`;

const exec = (...args: string[]) => execSync(args.join(' '), { stdio: 'inherit' });

const ghStatus = (state: string, description: string) =>
  exec(
    `gh api "repos/elastic/kibana/statuses/${process.env.BUILDKITE_COMMIT}"`,
    `-f state=${state}`,
    `-f target_url="${process.env.BUILDKITE_BUILD_URL}"`,
    `-f context="${GITHUB_CONTEXT}"`,
    `-f description="${description}"`,
    `--silent`
  );

const build = () => {
  console.log('--- Building Storybooks');

  for (const storybook of STORYBOOKS) {
    exec(`STORYBOOK_BASE_URL=${STORYBOOK_BASE_URL}`, `yarn storybook --site ${storybook}`);
  }
};

const upload = () => {
  const originalDirectory = process.cwd();
  try {
    console.log('--- Generating Storybooks HTML');

    process.chdir(path.join('.', 'built_assets', 'storybook'));

    const storybooks = execSync(`ls -1d */`)
      .toString()
      .trim()
      .split('\n')
      .map((filePath) => filePath.replace('/', ''));

    const listHtml = storybooks
      .map((storybook) => `<li><a href="${STORYBOOK_BASE_URL}/${storybook}">${storybook}</a></li>`)
      .join('\n');

    const html = `
      <html>
        <body>
          <h1>Storybooks</h1>
          <ul>
            ${listHtml}
          </ul>
        </body>
      </html>
    `;

    fs.writeFileSync('index.html', html);

    console.log('--- Uploading Storybooks');
    const activateScript = path.relative(
      process.cwd(),
      path.join(getKibanaDir(), '.buildkite', 'scripts', 'common', 'activate_service_account.sh')
    );
    exec(`
      ${activateScript} gs://ci-artifacts.kibana.dev
      gsutil -q -m cp -r -z js,css,html,json,map,txt,svg '*' 'gs://${STORYBOOK_BUCKET}/${STORYBOOK_DIRECTORY}/${process.env.BUILDKITE_COMMIT}/'
      gsutil -h "Cache-Control:no-cache, max-age=0, no-transform" cp -z html 'index.html' 'gs://${STORYBOOK_BUCKET}/${STORYBOOK_DIRECTORY}/latest/'
    `);

    if (process.env.BUILDKITE_PULL_REQUEST && process.env.BUILDKITE_PULL_REQUEST !== 'false') {
      exec(
        `buildkite-agent meta-data set pr_comment:storybooks:head '* [Storybooks Preview](${STORYBOOK_BASE_URL})'`
      );
    }
  } finally {
    process.chdir(originalDirectory);
  }
};

try {
  ghStatus('pending', 'Building Storybooks');
  build();
  upload();
  ghStatus('success', 'Storybooks built');
} catch (error) {
  ghStatus('error', 'Building Storybooks failed');
  throw error;
}
