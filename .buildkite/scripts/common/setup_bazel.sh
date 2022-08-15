#!/usr/bin/env bash

source .buildkite/scripts/common/util.sh

echo "[bazel] writing .bazelrc"
cat <<EOF > $KIBANA_DIR/.bazelrc
  # Generated by .buildkite/scripts/common/setup_bazel.sh

  import %workspace%/.bazelrc.common

  build --build_metadata=ROLE=CI
EOF

BAZEL_CACHE_MODE=${BAZEL_CACHE_MODE:-gcs}

if [[ "$BAZEL_CACHE_MODE" == "gcs" ]]; then
  echo "[bazel] enabling caching with GCS buckets"

  BAZEL_REGION="${BUILDKITE_AGENT_GCP_REGION:-us-central1}"
  BAZEL_BUCKET="kibana-ci-bazel_$BAZEL_REGION"

  echo "[bazel] using GCS bucket: $BAZEL_BUCKET"

cat <<EOF >> $KIBANA_DIR/.bazelrc
  build --remote_cache=https://storage.googleapis.com/$BAZEL_BUCKET
  build --google_default_credentials
EOF
fi

if [[ "$BAZEL_CACHE_MODE" == "buildbuddy" ]]; then
  echo "[bazel] enabling caching with Buildbuddy"
cat <<EOF >> $KIBANA_DIR/.bazelrc
  build --bes_results_url=https://app.buildbuddy.io/invocation/
  build --bes_backend=grpcs://remote.buildbuddy.io
  build --remote_cache=grpcs://remote.buildbuddy.io
  build --remote_timeout=3600
  build --remote_header=x-buildbuddy-api-key=$KIBANA_BUILDBUDDY_CI_API_KEY
EOF
fi

if [[ "$BAZEL_CACHE_MODE" != @(gcs|buildbuddy|none|) ]]; then
  echo "invalid value for BAZEL_CACHE_MODE received ($BAZEL_CACHE_MODE), expected one of [gcs,buildbuddy,none]"
  exit 1
fi
