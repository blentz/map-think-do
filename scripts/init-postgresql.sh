#!/bin/bash
# PostgreSQL Database Initialization Script for Sentient AGI Reasoning Server
# This script sets up PostgreSQL with proper database schema and test data

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
    
    # Start new container
    podman run -d \
        --name "$CONTAINER_NAME" \
        -p "$DB_PORT:5432" \
        -e POSTGRES_DB="$DB_NAME" \
        -e POSTGRES_USER="$DB_USER" \
        -e POSTGRES_PASSWORD="$DB_PASSWORD" \
        -v postgresql_data:/var/lib/postgresql/data \
        docker.io/postgres:16
    
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

# Function to create database schema
create_schema() {
    local db_name=$1
    
    # Create the schema SQL
    local schema_sql="
-- Sentient AGI Reasoning Server Database Schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";

-- Create stored_thoughts table
CREATE TABLE IF NOT EXISTS stored_thoughts (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    thought TEXT NOT NULL,
    thought_number INTEGER NOT NULL,
    total_thoughts INTEGER NOT NULL,
    next_thought_needed BOOLEAN NOT NULL DEFAULT false,
    
    -- Branching and revision metadata
    is_revision BOOLEAN DEFAULT false,
    revises_thought INTEGER,
    branch_from_thought INTEGER,
    branch_id VARCHAR(255),
    needs_more_thoughts BOOLEAN,
    
    -- Memory-specific metadata
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    confidence DECIMAL(3,2),
    domain VARCHAR(255),
    objective TEXT,
    complexity INTEGER,
    
    -- Outcome tracking
    success BOOLEAN,
    effectiveness_score DECIMAL(3,2),
    user_feedback TEXT,
    outcome_quality VARCHAR(50),
    
    -- Context information (JSONB for efficient querying)
    context JSONB DEFAULT '{}',
    
    -- Learning metadata
    tags TEXT[],
    patterns_detected TEXT[],
    similar_thoughts TEXT[],
    
    -- Output for reflection
    output TEXT,
    context_trace TEXT[],
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reasoning_sessions table
CREATE TABLE IF NOT EXISTS reasoning_sessions (
    id VARCHAR(255) PRIMARY KEY,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    objective TEXT NOT NULL,
    domain VARCHAR(255),
    initial_complexity INTEGER,
    final_complexity INTEGER,
    
    -- Session outcomes
    goal_achieved BOOLEAN NOT NULL DEFAULT false,
    confidence_level DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    total_thoughts INTEGER DEFAULT 0,
    revision_count INTEGER DEFAULT 0,
    branch_count INTEGER DEFAULT 0,
    
    -- Session patterns
    cognitive_roles_used TEXT[],
    metacognitive_interventions INTEGER DEFAULT 0,
    effectiveness_score DECIMAL(3,2),
    
    -- Learning insights
    lessons_learned TEXT[],
    successful_strategies TEXT[],
    failed_approaches TEXT[],
    
    tags TEXT[],
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stored_thoughts_session_id ON stored_thoughts(session_id);
CREATE INDEX IF NOT EXISTS idx_stored_thoughts_timestamp ON stored_thoughts(timestamp);
CREATE INDEX IF NOT EXISTS idx_stored_thoughts_domain ON stored_thoughts(domain);
CREATE INDEX IF NOT EXISTS idx_stored_thoughts_tags ON stored_thoughts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_stored_thoughts_context ON stored_thoughts USING GIN(context);
CREATE INDEX IF NOT EXISTS idx_stored_thoughts_thought_trgm ON stored_thoughts USING GIN(thought gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_start_time ON reasoning_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_domain ON reasoning_sessions(domain);
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_tags ON reasoning_sessions USING GIN(tags);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
\$\$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_stored_thoughts_updated_at ON stored_thoughts;
CREATE TRIGGER update_stored_thoughts_updated_at
    BEFORE UPDATE ON stored_thoughts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reasoning_sessions_updated_at ON reasoning_sessions;
CREATE TRIGGER update_reasoning_sessions_updated_at
    BEFORE UPDATE ON reasoning_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
"
    
    # Execute the schema creation
    podman exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$db_name" -c "$schema_sql"
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

# Function to show connection info
show_connection_info() {
    echo -e "${BLUE}📋 Connection Information:${NC}"
    echo -e "  Host: localhost"
    echo -e "  Port: $DB_PORT"
    echo -e "  Database: $DB_NAME"
    echo -e "  Test Database: $TEST_DB_NAME"
    echo -e "  User: $DB_USER"
    echo -e "  Password: $DB_PASSWORD"
    echo ""
    echo -e "${BLUE}🔧 Useful Commands:${NC}"
    echo -e "  Connect to main DB: podman exec -it $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
    echo -e "  Connect to test DB: podman exec -it $CONTAINER_NAME psql -U $DB_USER -d $TEST_DB_NAME"
    echo -e "  View logs: podman logs -f $CONTAINER_NAME"
    echo -e "  Stop: $0 stop"
    echo -e "  Restart: $0 restart"
}

# Function to display usage
usage() {
    echo -e "${BLUE}Usage: $0 {start|stop|restart|status|logs|clean}${NC}"
    echo ""
    echo -e "Commands:"
    echo -e "  start   - Start PostgreSQL and initialize databases"
    echo -e "  stop    - Stop PostgreSQL container"
    echo -e "  restart - Stop and start PostgreSQL"
    echo -e "  status  - Show PostgreSQL container status"
    echo -e "  logs    - Show PostgreSQL logs"
    echo -e "  clean   - Stop and remove container and volumes (DESTRUCTIVE)"
}

# Main command handling
case "${1:-start}" in
    start)
        start_postgres
        init_databases
        show_connection_info
        ;;
    stop)
        stop_postgres
        ;;
    restart)
        stop_postgres
        sleep 2
        start_postgres
        init_databases
        show_connection_info
        ;;
    status)
        if check_container; then
            echo -e "${GREEN}✅ PostgreSQL container is running${NC}"
            podman ps --filter "name=$CONTAINER_NAME"
        else
            echo -e "${RED}❌ PostgreSQL container is not running${NC}"
        fi
        ;;
    logs)
        if check_container; then
            podman logs -f "$CONTAINER_NAME"
        else
            echo -e "${RED}❌ PostgreSQL container is not running${NC}"
        fi
        ;;
    clean)
        echo -e "${RED}⚠️ This will destroy all data! Are you sure? (y/N)${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            stop_postgres
            podman rm -f "$CONTAINER_NAME" 2>/dev/null || true
            podman volume rm postgresql_data 2>/dev/null || true
            echo -e "${GREEN}✅ PostgreSQL container and data cleaned${NC}"
        else
            echo -e "${YELLOW}Operation cancelled${NC}"
        fi
        ;;
    *)
        usage
        exit 1
        ;;
esac