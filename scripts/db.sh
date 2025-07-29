#!/bin/bash
# Convenience script for database operations

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Forward all arguments to the PostgreSQL init script
exec "$SCRIPT_DIR/init-postgresql.sh" "$@"