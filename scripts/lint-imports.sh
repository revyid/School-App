#!/bin/sh
# Larangan impor helper TEST-ONLY di file non-tes.
# Helper @lacakedu/db/test-utils (koneksi app_system BYPASSRLS) hanya boleh dipakai
# dari *.test.ts. Dijalankan via `pnpm lint`.
set -eu
bad=0
for f in $(git grep -l -- '@lacakedu/db/test-utils' -- ':!*.test.ts' ':!scripts/lint-imports.sh' 2>/dev/null || true); do
  echo "LINT-FAIL: $f mengimpor @lacakedu/db/test-utils di luar *.test.ts"
  bad=1
done
if [ "$bad" -eq 0 ]; then echo "lint-imports OK"; fi
exit "$bad"
