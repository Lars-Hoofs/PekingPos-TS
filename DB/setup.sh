#!/usr/bin/env bash
# Creates the database and the test database in the SQL Server container, brings both up to date
# with the migrations, and writes .env. Run it again safely: existing data is left alone.
set -euo pipefail

CONTAINER="${CONTAINER:-pekinggarden-sql}"
PORT="${PORT:-1433}"
DATABASE="PekingGardenTypeScript"
TEST_DATABASE="PekingGardenTypeScriptTest"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HERE/../.env"

sql() {
  docker exec "$CONTAINER" bash -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -b -f 65001 "$@"' -- "$@"
}

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Container $CONTAINER does not exist. Create it first, with MSSQL_SA_PASSWORD set." >&2
  exit 1
fi

docker start "$CONTAINER" >/dev/null

ready=false
for _ in $(seq 1 30); do
  if sql -Q "SELECT 1" >/dev/null 2>&1; then ready=true; break; fi
  sleep 2
done
if [ "$ready" = false ]; then
  echo "SQL Server in $CONTAINER did not respond within 60 seconds." >&2
  exit 1
fi

for database in "$DATABASE" "$TEST_DATABASE"; do
  exists="$(sql -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID('$database') IS NULL THEN 0 ELSE 1 END" | tr -d '[:space:]')"
  # Migrations check themselves whether they already ran.
  migrations="03-ticket-station.sql"
  if [ "$exists" = "1" ]; then
    files="$migrations"
  else
    sql -Q "CREATE DATABASE [$database];"
    files="01-schema.sql 02-seed.sql $migrations"
  fi
  for file in $files; do
    docker cp -q "$HERE/$file" "$CONTAINER:/tmp/$file"
    sql -d "$database" -i "/tmp/$file"
  done
  echo "Database $database is up to date."
done

password="$(docker exec "$CONTAINER" printenv MSSQL_SA_PASSWORD)"
if [[ "$password" == *"'"* ]]; then
  echo "The sa password contains a single quote, which .env cannot hold this way. Write .env by hand." >&2
  exit 1
fi

umask 077
cat > "$ENV_FILE" <<ENV
DB_SERVER=localhost
DB_PORT=$PORT
DB_NAME=$DATABASE
DB_TEST_NAME=$TEST_DATABASE
DB_USER=sa
DB_PASSWORD='$password'
ENV
echo "Settings written to .env (only readable by you)."
