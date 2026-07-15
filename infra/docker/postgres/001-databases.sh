#!/usr/bin/env bash

set -Eeuo pipefail

required_variables=(
  APP_DB_NAME
  APP_DB_USERNAME
  APP_DB_PASSWORD
  TEST_DB_NAME
  TEST_DB_USERNAME
  TEST_DB_PASSWORD
  KEYCLOAK_DB_USERNAME
  KEYCLOAK_DB_PASSWORD
)

for variable_name in "${required_variables[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    printf 'Required local database variable is missing: %s\n' "$variable_name" >&2
    exit 1
  fi
done

for identifier_name in APP_DB_NAME APP_DB_USERNAME TEST_DB_NAME TEST_DB_USERNAME KEYCLOAK_DB_USERNAME; do
  identifier_value="${!identifier_name}"
  if [[ ! "$identifier_value" =~ ^[a-z_][a-z0-9_]*$ ]]; then
    printf 'Local database identifier is invalid: %s\n' "$identifier_name" >&2
    exit 1
  fi
done

create_role() {
  local role_name="$1"
  local role_password="$2"

  ROLE_PASSWORD="$role_password" psql --username "$POSTGRES_USER" --dbname postgres \
    --set=role_name="$role_name" <<-'SQL'
	\getenv role_password ROLE_PASSWORD
	SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role_name', :'role_password')
	WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role_name') \gexec
	\unset role_password
	SQL
}

create_database() {
  local database_name="$1"
  local owner_name="$2"

  psql --username "$POSTGRES_USER" --dbname postgres \
    --set=database_name="$database_name" --set=owner_name="$owner_name" <<-'SQL'
	SELECT format('CREATE DATABASE %I OWNER %I', :'database_name', :'owner_name')
	WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'database_name') \gexec
	SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC', :'database_name') \gexec
	SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', :'database_name', :'owner_name') \gexec
	SQL
}

create_role "$APP_DB_USERNAME" "$APP_DB_PASSWORD"
create_role "$TEST_DB_USERNAME" "$TEST_DB_PASSWORD"
create_role "$KEYCLOAK_DB_USERNAME" "$KEYCLOAK_DB_PASSWORD"

create_database "$APP_DB_NAME" "$APP_DB_USERNAME"
create_database "$TEST_DB_NAME" "$TEST_DB_USERNAME"
create_database keycloak "$KEYCLOAK_DB_USERNAME"
