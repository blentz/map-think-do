#!/bin/bash
# PostgreSQL Database Initialization Script for Sentient AGI Reasoning Server
# FIXED VERSION - Uses proper schema files instead of embedded SQL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="sentient-agi-postgresql"
DB_NAME="map_think_do"
TEST_DB_NAME="map_think_do_test"
DB_USER="mtd_user"
DB_PASSWORD="p4ssw0rd"
DB_PORT="5432"

echo -e "${BLUE}🐘 Initializing PostgreSQL for Sentient AGI Reasoning Server...${NC}"

# Function to check if container is running
check_container() {
    if podman ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        return 0
    else
        return 1
    fi
}

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if podman exec "$CONTAINER_NAME" pg_isready -h localhost -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is ready!${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}Attempt $attempt/$max_attempts - waiting for PostgreSQL...${NC}"
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ PostgreSQL failed to start within timeout${NC}"
    return 1
}

# Function to start PostgreSQL container
start_postgres() {
    if check_container; then
        echo -e "${GREEN}✅ PostgreSQL container is already running${NC}"
        return 0
    fi
    
    echo -e "${BLUE}🚀 Starting PostgreSQL container...${NC}"
    
    # Remove any existing stopped container
    if podman ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}🧹 Removing existing container...${NC}"
        podman rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
    
    # Start new container using the custom image with all extensions
    podman run -d \
        --name "$CONTAINER_NAME" \
        -p "$DB_PORT:5432" \
        -e POSTGRES_DB="$DB_NAME" \
        -e POSTGRES_USER="$DB_USER" \
        -e POSTGRES_PASSWORD="$DB_PASSWORD" \
        -v postgresql_data:/var/lib/postgresql/data \
        localhost/sentient-agi-postgresql:latest
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PostgreSQL container started successfully${NC}"
        wait_for_postgres
    else
        echo -e "${RED}❌ Failed to start PostgreSQL container${NC}"
        return 1
    fi
}

# Function to create databases and schema
init_databases() {
    echo -e "${BLUE}🗄️ Initializing databases and schema...${NC}"
    
    # Create test database
    echo -e "${YELLOW}Creating test database...${NC}"
    podman exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;" || true
    podman exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "CREATE DATABASE $TEST_DB_NAME;"
    
    # Create schema for main database
    echo -e "${YELLOW}Creating schema for main database...${NC}"
    create_schema "$DB_NAME"
    
    # Create schema for test database
    echo -e "${YELLOW}Creating schema for test database...${NC}"
    create_schema "$TEST_DB_NAME"
    
    echo -e "${GREEN}✅ Databases and schema initialized successfully${NC}"
}

# Function to create database schema using proper schema files
create_schema() {
    local db_name=$1
    local project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    
    echo -e "${YELLOW}Applying schema files for $db_name...${NC}"
    
    # Use the proper schema files instead of embedded SQL
    local init_scripts_dir="$project_root/container-files/postgresql/init-scripts"
    
    if [ -d "$init_scripts_dir" ]; then
        # Apply schema files in order (01-extensions, 02-schema, etc.)
        for sql_file in "$init_scripts_dir"/*.sql; do
            if [ -f "$sql_file" ]; then
                local filename=$(basename "$sql_file")
                echo -e "${YELLOW}Applying $filename to $db_name...${NC}"
                podman cp "$sql_file" "$CONTAINER_NAME:/tmp/$filename"
                podman exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$db_name" -f "/tmp/$filename"
            fi
        done
        echo -e "${GREEN}✅ Schema applied successfully to $db_name${NC}"
    else
        echo -e "${RED}❌ Schema files not found at $init_scripts_dir${NC}"
        return 1
    fi
}

# Function to stop PostgreSQL
stop_postgres() {
    if check_container; then
        echo -e "${YELLOW}🛑 Stopping PostgreSQL container...${NC}"
        podman stop "$CONTAINER_NAME"
        echo -e "${GREEN}✅ PostgreSQL container stopped${NC}"
    else
        echo -e "${YELLOW}⚠️ PostgreSQL container is not running${NC}"
    fi
}

# Function to remove PostgreSQL container
remove_postgres() {
    stop_postgres
    if podman ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}🗑️ Removing PostgreSQL container...${NC}"
        podman rm "$CONTAINER_NAME"
        echo -e "${GREEN}✅ PostgreSQL container removed${NC}"
    fi
}

# Function to show PostgreSQL status
status_postgres() {
    if check_container; then
        echo -e "${GREEN}✅ PostgreSQL container is running${NC}"
        podman ps --filter "name=$CONTAINER_NAME"
    else
        echo -e "${RED}❌ PostgreSQL container is not running${NC}"
    fi
}

# Function to show logs
logs_postgres() {
    if check_container; then
        podman logs -f "$CONTAINER_NAME"
    else
        echo -e "${RED}❌ PostgreSQL container is not running${NC}"
    fi
}

# Function to display connection information
show_connection_info() {
    echo -e "${BLUE}📋 Connection Information:${NC}"
    echo "  Host: localhost"
    echo "  Port: $DB_PORT"
    echo "  Database: $DB_NAME"
    echo "  Test Database: $TEST_DB_NAME"
    echo "  User: $DB_USER"
    echo "  Password: $DB_PASSWORD"
    echo ""
    echo -e "${BLUE}🔧 Useful Commands:${NC}"
    echo "  Connect to main DB: podman exec -it $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
    echo "  Connect to test DB: podman exec -it $CONTAINER_NAME psql -U $DB_USER -d $TEST_DB_NAME"
    echo "  View logs: podman logs -f $CONTAINER_NAME"
    echo "  Stop: $(realpath "$0") stop"
    echo "  Restart: $(realpath "$0") restart"
}

# Main execution logic
case "${1:-start}" in
    "start")
        start_postgres
        init_databases
        show_connection_info
        ;;
    "stop")
        stop_postgres
        ;;
    "restart")
        stop_postgres
        start_postgres
        init_databases
        show_connection_info
        ;;
    "remove"|"clean")
        remove_postgres
        ;;
    "status")
        status_postgres
        ;;
    "logs")
        logs_postgres
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|remove|clean|status|logs}"
        exit 1
        ;;
esac