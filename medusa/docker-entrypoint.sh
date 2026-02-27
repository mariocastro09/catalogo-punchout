#!/bin/sh
set -e

# Number of times to retry the migration
MAX_RETRIES=10
# Seconds to wait between retries
RETRY_DELAY=10

echo "⏳ Waiting for database to be ready and running migrations..."

for i in $(seq 1 $MAX_RETRIES); do
  # Run medusa db:migrate. This is expected to fail if the DB is still booting 
  # or if there's a transient connection issue.
  if ./node_modules/.bin/medusa db:migrate; then
    echo "✅ Migrations complete."
    break
  else
    if [ "$i" -eq "$MAX_RETRIES" ]; then
      echo "❌ Max retries reached. Migrations failed."
      exit 1
    fi
    echo "⚠ Migration attempt $i/$MAX_RETRIES failed — retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
  fi
done

echo "🚀 Starting Medusa..."
exec bun run start
