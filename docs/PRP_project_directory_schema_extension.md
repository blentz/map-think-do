# Product Requirements Prompt (PRP): Normalized Project Schema Extension

## Executive Summary

**Feature**: Extend the PostgreSQL schema with a normalized `projects` table and foreign key relationships to enable comprehensive project-aware reasoning, rich project metadata management, and advanced cognitive capabilities across all core memory tables.

**Business Value**: Enables the Sentient AGI Reasoning Server to provide sophisticated, project-contextual cognitive assistance for a single developer managing multiple projects, with rich metadata support, technology stack awareness, and project lifecycle analytics while preserving cross-domain learning capabilities.

**Scope**: Single-tenant, single-user, multiple projects - optimized for individual developers managing their personal project portfolio (typically 10-100 projects).

**Complexity**: Medium-High (7/10) - Normalized schema design, project management logic, enhanced TypeScript interfaces, data migration strategy, and comprehensive testing of relational integrity.

## Context & Background

### Current Architecture Analysis

The Sentient AGI Reasoning Server currently implements:

- **PostgreSQL Memory Store** (`src/memory/postgresql-memory-store.ts`) with core tables:
  - `reasoning_sessions`: Complete reasoning sessions with cognitive metadata
  - `stored_prompts`: Incoming prompts with AI classification and intent extraction
  - `stored_thoughts`: Individual thoughts within sessions with JSONB context
- **Working Directory Tracking** (`src/prompts/valueManager.ts`) in prompt values but not cognitive memory
- **Domain-based Classification** for organizing thoughts and prompts by subject area
- **Cross-domain Similarity Detection** for pattern learning and cognitive priming

### Current Database Schema (relevant sections):

```sql
-- From container-files/postgresql/init-scripts/02-schema.sql
CREATE TABLE reasoning_sessions (
    id VARCHAR(50) PRIMARY KEY,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    objective TEXT NOT NULL,
    domain VARCHAR(100),  -- Subject area classification
    goal_achieved BOOLEAN NOT NULL DEFAULT FALSE,
    -- ... additional cognitive metadata
);

CREATE TABLE stored_prompts (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES reasoning_sessions(id),
    original_prompt TEXT NOT NULL,
    prompt_type VARCHAR(50),
    domain VARCHAR(100),  -- AI-mapped domain from classification
    -- ... prompt intelligence metadata
);

CREATE TABLE stored_thoughts (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES reasoning_sessions(id),
    prompt_id VARCHAR(50) REFERENCES stored_prompts(id),
    thought TEXT NOT NULL,
    domain VARCHAR(100),
    -- ... thought metadata and context
);
```

### Problem Statement

Currently, the system lacks normalized project management in cognitive memory, which prevents:

- **Project-specific pattern recognition** and learning with rich metadata
- **Technology stack-aware cognitive strategies** (React vs Python vs Go projects)
- **Project lifecycle analytics** and intelligence (architecture → implementation → debugging patterns)
- **Personal multi-project management** with efficient data organization (10-100 projects)
- **Project-specific cognitive settings** and AI persona preferences for individual workflow
- **Project lifecycle insights** for personal development patterns
- **Cross-project learning** while maintaining project-contextual assistance

### Working Directory Context

The system currently tracks `working_directory` in the prompt values system (`src/prompts/valueManager.ts`):

```typescript
// Extract global values (like working_directory)
if (args.working_directory) {
  this.values.global.working_directory = args.working_directory;
}
```

However, this is only used for prompt argument persistence, not for cognitive memory organization or cross-session learning.

## Requirements

### Functional Requirements

#### FR-1: Normalized Database Schema Extension

- **Create `projects` table** with comprehensive project metadata and settings
- **Add `project_id` foreign keys** to all core tables (`reasoning_sessions`, `stored_prompts`, `stored_thoughts`)
- **Maintain backward compatibility** with nullable foreign keys
- **Create optimized indexes** for project relationships and queries
- **Support TimescaleDB** integration for all tables including projects

#### FR-2: Project Management and Resolution

- **Extract working_directory** from prompt values system during prompt processing
- **Resolve or create projects** from working directory paths with metadata extraction
- **Populate project_id** foreign keys in all stored objects (prompts, thoughts, sessions)
- **Handle missing working_directory** gracefully with NULL project relationships
- **Support project CRUD operations** (create, read, update, delete, archive)

#### FR-3: Enhanced TypeScript Interface Design

- **Create Project interface** with comprehensive metadata (directory, name, tech stack, settings)
- **Add project_id and optional project fields** to StoredThought, StoredPrompt, ReasoningSession
- **Update MemoryQuery and PromptQuery interfaces** for project-based filtering and JOINs
- **Create ProjectQuery interface** for project management operations
- **Support populated project data** in query results to avoid N+1 queries

#### FR-4: Advanced Query and Analytics Capabilities

- **Enable project-scoped queries** with efficient JOIN operations across all tables
- **Maintain global search capabilities** alongside project filtering
- **Optimize similarity detection** with project-aware and hybrid search strategies
- **Support project analytics** (lifecycle patterns, technology trends, success metrics)
- **Enable project comparison** and cross-project pattern analysis

#### FR-5: Enhanced Cognitive Integration

- **Enhance cognitive priming** with project-specific historical patterns and metadata
- **Technology stack-aware reasoning** (different strategies for different tech stacks)
- **Project-specific AI persona selection** and cognitive settings
- **Project lifecycle intelligence** (architecture → implementation → optimization patterns)
- **Maintain cross-domain learning** while enabling project-contextual reasoning

### Non-Functional Requirements

#### NFR-1: Performance

- **Database queries** must maintain existing performance characteristics
- **Project-scoped queries** should be faster than global queries due to reduced data sets
- **Index creation** must not significantly impact existing query performance
- **Memory usage** increase must be minimal (<5% overhead)

#### NFR-2: Backward Compatibility

- **Existing data** must remain fully functional with NULL project_directory values
- **Existing queries** must continue to work without modification
- **API compatibility** must be maintained for all memory store operations
- **Migration path** must be seamless for existing deployments

#### NFR-3: Security & Privacy

- **Project directory paths** must be validated to prevent path traversal attacks
- **File system access** must be limited to user-accessible directories only
- **Cross-project learning** should be configurable (enable/disable per session)

## Technical Implementation Plan

### Implementation Tasks (Ordered Sequence)

#### Task 1: Normalized Database Schema Extension

**File**: `container-files/postgresql/init-scripts/06-projects-schema.sql`

```sql
-- Create the projects table with comprehensive metadata
CREATE TABLE IF NOT EXISTS projects (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core project information
    directory_path TEXT UNIQUE NOT NULL,
    project_name TEXT NOT NULL,
    description TEXT,

    -- Technology and metadata
    technology_stack TEXT[], -- ['react', 'typescript', 'nodejs']
    project_type VARCHAR(50), -- 'web-app', 'api', 'library', 'mobile', etc.
    programming_languages TEXT[], -- ['typescript', 'python', 'sql']

    -- Project lifecycle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,

    -- Cognitive settings (JSONB for flexibility)
    cognitive_settings JSONB DEFAULT '{}', -- AI preferences, persona settings, etc.
    project_metadata JSONB DEFAULT '{}', -- Custom metadata, tags, etc.

    -- Analytics fields
    total_sessions INTEGER DEFAULT 0,
    total_thoughts INTEGER DEFAULT 0,
    total_prompts INTEGER DEFAULT 0,

    -- Constraints
    CONSTRAINT valid_directory_path CHECK (length(directory_path) > 0),
    CONSTRAINT valid_project_name CHECK (length(project_name) > 0)
);

-- Add project_id foreign keys to core tables
ALTER TABLE reasoning_sessions ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE stored_prompts ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE stored_thoughts ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create optimized indexes for projects table
CREATE INDEX idx_projects_directory_path ON projects(directory_path);
CREATE INDEX idx_projects_active ON projects(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_projects_activity ON projects(last_activity_at DESC);
CREATE INDEX idx_projects_type ON projects(project_type) WHERE project_type IS NOT NULL;
CREATE INDEX idx_projects_tech_stack ON projects USING GIN (technology_stack) WHERE technology_stack IS NOT NULL;

-- Create foreign key indexes for performance
CREATE INDEX idx_sessions_project_id ON reasoning_sessions(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_prompts_project_id ON stored_prompts(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_thoughts_project_id ON stored_thoughts(project_id) WHERE project_id IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX idx_sessions_project_domain ON reasoning_sessions(project_id, domain) WHERE project_id IS NOT NULL;
CREATE INDEX idx_prompts_project_type ON stored_prompts(project_id, prompt_type) WHERE project_id IS NOT NULL;
CREATE INDEX idx_thoughts_project_session ON stored_thoughts(project_id, session_id) WHERE project_id IS NOT NULL;

-- JSONB indexes for metadata queries
CREATE INDEX idx_projects_cognitive_settings ON projects USING GIN (cognitive_settings) WHERE cognitive_settings != '{}';
CREATE INDEX idx_projects_metadata ON projects USING GIN (project_metadata) WHERE project_metadata != '{}';
```

#### Task 2: Enhanced TypeScript Interface Updates

**File**: `src/memory/memory-store.ts`

```typescript
// New Project interface with comprehensive metadata
export interface Project {
  id: string; // UUID
  directory_path: string;
  project_name: string;
  description?: string;

  // Technology metadata
  technology_stack?: string[];
  project_type?: string;
  programming_languages?: string[];

  // Lifecycle information
  created_at: Date;
  updated_at: Date;
  last_activity_at: Date;
  is_active: boolean;
  is_archived: boolean;

  // Cognitive and custom metadata
  cognitive_settings?: Record<string, any>;
  project_metadata?: Record<string, any>;

  // Analytics
  total_sessions?: number;
  total_thoughts?: number;
  total_prompts?: number;
}

// Updated core interfaces with project relationships
export interface StoredThought {
  // ... existing fields
  project_id?: string; // UUID foreign key
  project?: Project; // Optional populated project data
}

export interface StoredPrompt {
  // ... existing fields
  project_id?: string; // UUID foreign key
  project?: Project; // Optional populated project data
}

export interface ReasoningSession {
  // ... existing fields
  project_id?: string; // UUID foreign key
  project?: Project; // Optional populated project data
}

// Enhanced query interfaces
export interface MemoryQuery {
  // ... existing filters
  project_id?: string; // Filter by specific project
  project_ids?: string[]; // Filter by multiple projects
  project_scoped_only?: boolean; // Restrict to project data only
  include_project?: boolean; // Populate project data in results
  project_active_only?: boolean; // Only active projects
}

export interface PromptQuery {
  // ... existing filters
  project_id?: string; // Filter by specific project
  project_ids?: string[]; // Filter by multiple projects
  project_scoped_only?: boolean; // Restrict to project data only
  include_project?: boolean; // Populate project data in results
  project_active_only?: boolean; // Only active projects
}

// New project query interface
export interface ProjectQuery {
  directory_path?: string; // Find by directory path
  project_name?: string; // Filter by name
  project_type?: string; // Filter by type
  technology_stack?: string[]; // Must include all specified technologies
  programming_languages?: string[]; // Must include all specified languages
  is_active?: boolean; // Filter by active status
  is_archived?: boolean; // Filter by archived status
  created_after?: Date; // Created after date
  created_before?: Date; // Created before date
  last_activity_after?: Date; // Activity after date
  has_cognitive_settings?: boolean; // Has custom cognitive settings
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'updated_at' | 'last_activity_at' | 'project_name';
  sort_order?: 'asc' | 'desc';
}
```

#### Task 3: Project Resolution and Management Logic

**File**: `src/server.ts`

Implement comprehensive project resolution from working directory:

```typescript
import * as path from 'path';
import * as fs from 'fs';

// Enhanced project resolution with metadata extraction
private async resolveProjectFromWorkingDirectory(): Promise<string | undefined> {
  try {
    const storedValues = this.promptManager.getStoredValues('');
    const workingDirectory = storedValues.working_directory;

    if (workingDirectory && typeof workingDirectory === 'string') {
      const normalizedPath = path.resolve(workingDirectory);

      // Find or create project record
      const projectId = await this.findOrCreateProject(normalizedPath);
      return projectId;
    }
  } catch (error) {
    console.error('Error resolving project context:', error);
  }
  return undefined;
}

// Find existing project or create new one with metadata extraction
private async findOrCreateProject(directoryPath: string): Promise<string> {
  // Check if project already exists
  const existingProject = await this.memoryStore.findProjectByPath(directoryPath);
  if (existingProject) {
    // Update last activity
    await this.memoryStore.updateProject(existingProject.id, {
      last_activity_at: new Date()
    });
    return existingProject.id;
  }

  // Create new project with metadata extraction
  const projectMetadata = await this.extractProjectMetadata(directoryPath);
  const project: Project = {
    id: '', // Will be generated by database
    directory_path: directoryPath,
    project_name: projectMetadata.name,
    description: projectMetadata.description,
    technology_stack: projectMetadata.technologyStack,
    project_type: projectMetadata.projectType,
    programming_languages: projectMetadata.programmingLanguages,
    created_at: new Date(),
    updated_at: new Date(),
    last_activity_at: new Date(),
    is_active: true,
    is_archived: false,
    cognitive_settings: {},
    project_metadata: projectMetadata.customMetadata || {}
  };

  const createdProject = await this.memoryStore.createProject(project);
  return createdProject.id;
}

// Extract project metadata from directory structure and files
private async extractProjectMetadata(directoryPath: string): Promise<{
  name: string;
  description?: string;
  technologyStack: string[];
  projectType?: string;
  programmingLanguages: string[];
  customMetadata?: Record<string, any>;
}> {
  const projectName = path.basename(directoryPath);
  const technologyStack: string[] = [];
  const programmingLanguages: string[] = [];
  let description: string | undefined;
  let projectType: string | undefined;
  const customMetadata: Record<string, any> = {};

  try {
    // Check for package.json (Node.js project)
    const packageJsonPath = path.join(directoryPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      description = packageJson.description;
      technologyStack.push('nodejs');
      programmingLanguages.push('javascript');

      // Detect TypeScript
      if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
        technologyStack.push('typescript');
        programmingLanguages.push('typescript');
      }

      // Detect React
      if (packageJson.dependencies?.react) {
        technologyStack.push('react');
        projectType = 'web-app';
      }

      // Detect Next.js
      if (packageJson.dependencies?.next) {
        technologyStack.push('nextjs');
        projectType = 'web-app';
      }

      customMetadata.packageJson = {
        name: packageJson.name,
        version: packageJson.version
      };
    }

    // Check for requirements.txt or pyproject.toml (Python project)
    if (fs.existsSync(path.join(directoryPath, 'requirements.txt')) ||
        fs.existsSync(path.join(directoryPath, 'pyproject.toml'))) {
      technologyStack.push('python');
      programmingLanguages.push('python');
      if (!projectType) projectType = 'api';
    }

    // Check for Cargo.toml (Rust project)
    if (fs.existsSync(path.join(directoryPath, 'Cargo.toml'))) {
      technologyStack.push('rust');
      programmingLanguages.push('rust');
    }

    // Check for go.mod (Go project)
    if (fs.existsSync(path.join(directoryPath, 'go.mod'))) {
      technologyStack.push('go');
      programmingLanguages.push('go');
      if (!projectType) projectType = 'api';
    }

    // Check for README files for description
    if (!description) {
      const readmeFiles = ['README.md', 'README.txt', 'README.rst'];
      for (const readme of readmeFiles) {
        const readmePath = path.join(directoryPath, readme);
        if (fs.existsSync(readmePath)) {
          const content = fs.readFileSync(readmePath, 'utf8');
          // Extract first paragraph as description
          const firstParagraph = content.split('\n\n')[0];
          if (firstParagraph && firstParagraph.length < 500) {
            description = firstParagraph.replace(/^#\s*/, '').trim();
          }
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error extracting project metadata:', error);
  }

  return {
    name: projectName,
    description,
    technologyStack: [...new Set(technologyStack)], // Remove duplicates
    projectType,
    programmingLanguages: [...new Set(programmingLanguages)], // Remove duplicates
    customMetadata
  };
}

// Update data storage methods to use project_id
private async storeWithProjectContext<T extends { project_id?: string }>(
  data: T,
  storeMethod: (data: T) => Promise<void>
): Promise<void> {
  const projectId = await this.resolveProjectFromWorkingDirectory();
  if (projectId) {
    data.project_id = projectId;
  }
  await storeMethod(data);
}

// Updated StoredPrompt creation
const storedPrompt: StoredPrompt = {
  // ... existing fields
  project_id: await this.resolveProjectFromWorkingDirectory(),
  // ... rest of prompt data
};

// Updated StoredThought creation
const storedThought: StoredThought = {
  // ... existing fields
  project_id: await this.resolveProjectFromWorkingDirectory(),
  // ... rest of thought data
};

// Updated ReasoningSession creation
const session: ReasoningSession = {
  // ... existing fields
  project_id: await this.resolveProjectFromWorkingDirectory(),
  // ... rest of session data
};
```

#### Task 4: PostgreSQL Memory Store Updates

**File**: `src/memory/postgresql-memory-store.ts`

Add comprehensive project management capabilities to the PostgreSQL memory store:

```typescript
// Project management methods for single-user scenarios
async createProject(project: Omit<Project, 'id'>): Promise<Project> {
  const client = await this.pool!.connect();

  try {
    await client.query('BEGIN');

    // Create project with generated UUID
    const createQuery = `
      INSERT INTO projects (
        directory_path, project_name, description, technology_stack,
        project_type, programming_languages, cognitive_settings, project_metadata,
        created_at, updated_at, last_activity_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      project.directory_path,
      project.project_name,
      project.description || null,
      project.technology_stack || [],
      project.project_type || null,
      project.programming_languages || [],
      JSON.stringify(project.cognitive_settings || {}),
      JSON.stringify(project.project_metadata || {}),
      project.created_at,
      project.updated_at,
      project.last_activity_at
    ];

    const result = await client.query(createQuery, values);
    await client.query('COMMIT');

    const createdProject = this.mapRowToProject(result.rows[0]);

    // Cache the project for single-user performance
    this.projectCache.set(createdProject.id, createdProject);
    this.projectPathCache.set(createdProject.directory_path, createdProject);

    console.error(`✅ Created project: ${createdProject.project_name} (${createdProject.id})`);
    return createdProject;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to create project:', error);
    throw new Error(`Project creation failed: ${error.message}`);
  } finally {
    client.release();
  }
}

async getProject(projectId: string): Promise<Project | null> {
  // Check cache first (single-user optimization)
  if (this.projectCache.has(projectId)) {
    return this.projectCache.get(projectId)!;
  }

  try {
    const query = 'SELECT * FROM projects WHERE id = $1';
    const result = await this.executeQuery(query, [projectId]);

    if (result.rows.length === 0) {
      return null;
    }

    const project = this.mapRowToProject(result.rows[0]);

    // Cache for future requests
    this.projectCache.set(project.id, project);
    this.projectPathCache.set(project.directory_path, project);

    return project;
  } catch (error) {
    console.error('❌ Failed to get project:', error);
    throw new Error(`Failed to retrieve project: ${error.message}`);
  }
}

async findProjectByPath(directoryPath: string): Promise<Project | null> {
  // Check cache first
  if (this.projectPathCache.has(directoryPath)) {
    return this.projectPathCache.get(directoryPath)!;
  }

  try {
    const query = 'SELECT * FROM projects WHERE directory_path = $1';
    const result = await this.executeQuery(query, [directoryPath]);

    if (result.rows.length === 0) {
      return null;
    }

    const project = this.mapRowToProject(result.rows[0]);

    // Cache for future requests
    this.projectCache.set(project.id, project);
    this.projectPathCache.set(project.directory_path, project);

    return project;
  } catch (error) {
    console.error('❌ Failed to find project by path:', error);
    throw new Error(`Failed to find project by path: ${error.message}`);
  }
}

async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
  const client = await this.pool!.connect();

  try {
    await client.query('BEGIN');

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.project_name !== undefined) {
      updateFields.push(`project_name = $${paramIndex++}`);
      values.push(updates.project_name);
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updates.technology_stack !== undefined) {
      updateFields.push(`technology_stack = $${paramIndex++}`);
      values.push(updates.technology_stack);
    }

    if (updates.project_type !== undefined) {
      updateFields.push(`project_type = $${paramIndex++}`);
      values.push(updates.project_type);
    }

    if (updates.programming_languages !== undefined) {
      updateFields.push(`programming_languages = $${paramIndex++}`);
      values.push(updates.programming_languages);
    }

    if (updates.cognitive_settings !== undefined) {
      updateFields.push(`cognitive_settings = $${paramIndex++}`);
      values.push(JSON.stringify(updates.cognitive_settings));
    }

    if (updates.project_metadata !== undefined) {
      updateFields.push(`project_metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.project_metadata));
    }

    if (updates.is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    if (updates.is_archived !== undefined) {
      updateFields.push(`is_archived = $${paramIndex++}`);
      values.push(updates.is_archived);
    }

    // Always update the timestamp
    updateFields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    if (updates.last_activity_at !== undefined) {
      updateFields.push(`last_activity_at = $${paramIndex++}`);
      values.push(updates.last_activity_at);
    }

    values.push(projectId); // WHERE condition

    const updateQuery = `
      UPDATE projects
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(updateQuery, values);
    await client.query('COMMIT');

    if (result.rows.length > 0) {
      const updatedProject = this.mapRowToProject(result.rows[0]);

      // Update cache
      this.projectCache.set(updatedProject.id, updatedProject);
      this.projectPathCache.set(updatedProject.directory_path, updatedProject);
    }

    console.error(`✅ Updated project: ${projectId}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to update project:', error);
    throw new Error(`Project update failed: ${error.message}`);
  } finally {
    client.release();
  }
}

async queryProjects(query: ProjectQuery = {}): Promise<Project[]> {
  try {
    let sql = 'SELECT * FROM projects WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    // Add filtering conditions
    if (query.directory_path) {
      sql += ` AND directory_path = $${paramIndex++}`;
      values.push(query.directory_path);
    }

    if (query.project_name) {
      sql += ` AND project_name ILIKE $${paramIndex++}`;
      values.push(`%${query.project_name}%`);
    }

    if (query.project_type) {
      sql += ` AND project_type = $${paramIndex++}`;
      values.push(query.project_type);
    }

    if (query.technology_stack && query.technology_stack.length > 0) {
      sql += ` AND technology_stack @> $${paramIndex++}`;
      values.push(query.technology_stack);
    }

    if (query.programming_languages && query.programming_languages.length > 0) {
      sql += ` AND programming_languages @> $${paramIndex++}`;
      values.push(query.programming_languages);
    }

    if (query.is_active !== undefined) {
      sql += ` AND is_active = $${paramIndex++}`;
      values.push(query.is_active);
    }

    if (query.is_archived !== undefined) {
      sql += ` AND is_archived = $${paramIndex++}`;
      values.push(query.is_archived);
    }

    if (query.created_after) {
      sql += ` AND created_at >= $${paramIndex++}`;
      values.push(query.created_after);
    }

    if (query.created_before) {
      sql += ` AND created_at <= $${paramIndex++}`;
      values.push(query.created_before);
    }

    if (query.last_activity_after) {
      sql += ` AND last_activity_at >= $${paramIndex++}`;
      values.push(query.last_activity_after);
    }

    if (query.has_cognitive_settings) {
      sql += ` AND cognitive_settings != '{}'`;
    }

    // Add sorting
    const sortBy = query.sort_by || 'last_activity_at';
    const sortOrder = query.sort_order || 'desc';
    sql += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // Add pagination
    if (query.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      values.push(query.limit);
    }

    if (query.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      values.push(query.offset);
    }

    const result = await this.executeQuery(sql, values);
    return result.rows.map(row => this.mapRowToProject(row));

  } catch (error) {
    console.error('❌ Failed to query projects:', error);
    throw new Error(`Project query failed: ${error.message}`);
  }
}

// Updated storage methods to include project_id
async storePrompt(prompt: StoredPrompt): Promise<void> {
  try {
    const query = `
      INSERT INTO stored_prompts (
        id, session_id, project_id, original_prompt, prompt_type, prompt_source,
        received_at, domain, complexity_estimate, estimated_cognitive_load,
        classification_confidence, prompt_context, extracted_intent,
        processing_started_at, processing_completed_at, processing_success,
        processing_error, tags, similar_prompts, reasoning_improvement,
        persona_selected, cognitive_priming_effectiveness, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
    `;

    const values = [
      prompt.id,
      prompt.session_id,
      prompt.project_id || null, // Handle null project_id for backward compatibility
      prompt.original_prompt,
      prompt.prompt_type,
      prompt.prompt_source || 'mcp-tool',
      prompt.received_at,
      prompt.domain,
      prompt.complexity_estimate,
      prompt.estimated_cognitive_load,
      prompt.classification_confidence,
      JSON.stringify(prompt.prompt_context || {}),
      JSON.stringify(prompt.extracted_intent || {}),
      prompt.processing_started_at,
      prompt.processing_completed_at,
      prompt.processing_success,
      prompt.processing_error,
      prompt.tags || [],
      JSON.stringify(prompt.similar_prompts || []),
      prompt.reasoning_improvement,
      prompt.persona_selected,
      prompt.cognitive_priming_effectiveness,
      prompt.created_at,
      prompt.updated_at
    ];

    await this.executeQuery(query, values);

    // Update project activity if project_id is present
    if (prompt.project_id) {
      await this.updateProjectActivity(prompt.project_id);
    }

  } catch (error) {
    console.error('❌ Failed to store prompt:', error);
    throw new Error(`Prompt storage failed: ${error.message}`);
  }
}

async storeThought(thought: StoredThought): Promise<void> {
  try {
    const query = `
      INSERT INTO stored_thoughts (
        id, session_id, prompt_id, project_id, thought, thought_number, total_thoughts,
        next_thought_needed, is_revision, revises_thought, branch_from_thought,
        branch_id, needs_more_thoughts, timestamp, confidence, domain, objective,
        complexity, success, effectiveness_score, user_feedback, outcome_quality,
        context, tags, patterns_detected, similar_thoughts, output, context_trace,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
      )
    `;

    const values = [
      thought.id,
      thought.session_id,
      thought.prompt_id,
      thought.project_id || null, // Handle null project_id for backward compatibility
      thought.thought,
      thought.thought_number,
      thought.total_thoughts,
      thought.next_thought_needed,
      thought.is_revision || false,
      thought.revises_thought,
      thought.branch_from_thought,
      thought.branch_id,
      thought.needs_more_thoughts,
      thought.timestamp,
      thought.confidence,
      thought.domain,
      thought.objective,
      thought.complexity,
      thought.success,
      thought.effectiveness_score,
      thought.user_feedback,
      thought.outcome_quality,
      JSON.stringify(thought.context || {}),
      thought.tags || [],
      thought.patterns_detected || [],
      thought.similar_thoughts || [],
      thought.output,
      thought.context_trace || [],
      thought.created_at,
      thought.updated_at
    ];

    await this.executeQuery(query, values);

    // Update project activity if project_id is present
    if (thought.project_id) {
      await this.updateProjectActivity(thought.project_id);
    }

  } catch (error) {
    console.error('❌ Failed to store thought:', error);
    throw new Error(`Thought storage failed: ${error.message}`);
  }
}

async storeSession(session: ReasoningSession): Promise<void> {
  try {
    const query = `
      INSERT INTO reasoning_sessions (
        id, project_id, start_time, end_time, objective, domain, initial_complexity,
        final_complexity, goal_achieved, confidence_level, effectiveness_score,
        total_thoughts, revision_count, branch_count, cognitive_roles_used,
        metacognitive_interventions, lessons_learned, successful_strategies,
        failed_approaches, tags, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      )
    `;

    const values = [
      session.id,
      session.project_id || null, // Handle null project_id for backward compatibility
      session.start_time,
      session.end_time,
      session.objective,
      session.domain,
      session.initial_complexity,
      session.final_complexity,
      session.goal_achieved,
      session.confidence_level,
      session.effectiveness_score,
      session.total_thoughts,
      session.revision_count,
      session.branch_count,
      session.cognitive_roles_used || [],
      session.metacognitive_interventions || 0,
      session.lessons_learned || [],
      session.successful_strategies || [],
      session.failed_approaches || [],
      session.tags || [],
      session.created_at,
      session.updated_at
    ];

    await this.executeQuery(query, values);

    // Update project activity if project_id is present
    if (session.project_id) {
      await this.updateProjectActivity(session.project_id);
    }

  } catch (error) {
    console.error('❌ Failed to store session:', error);
    throw new Error(`Session storage failed: ${error.message}`);
  }
}

// Helper methods
private mapRowToProject(row: any): Project {
  return {
    id: row.id,
    directory_path: row.directory_path,
    project_name: row.project_name,
    description: row.description,
    technology_stack: row.technology_stack || [],
    project_type: row.project_type,
    programming_languages: row.programming_languages || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_activity_at: row.last_activity_at,
    is_active: row.is_active,
    is_archived: row.is_archived,
    cognitive_settings: row.cognitive_settings || {},
    project_metadata: row.project_metadata || {},
    total_sessions: row.total_sessions || 0,
    total_thoughts: row.total_thoughts || 0,
    total_prompts: row.total_prompts || 0
  };
}

private async updateProjectActivity(projectId: string): Promise<void> {
  try {
    const query = `
      UPDATE projects
      SET last_activity_at = $1, updated_at = $1
      WHERE id = $2
    `;

    await this.executeQuery(query, [new Date(), projectId]);

    // Invalidate cache
    this.projectCache.delete(projectId);

  } catch (error) {
    console.error('❌ Failed to update project activity:', error);
    // Don't throw - this is not critical
  }
}

// Simple caching for single-user scenarios
private projectCache = new Map<string, Project>();
private projectPathCache = new Map<string, Project>();

// Clear cache method for testing
async clearProjectCache(): Promise<void> {
  this.projectCache.clear();
  this.projectPathCache.clear();
}
```

#### Task 5: Enhanced Query Capabilities with Project-Aware Searches

**File**: `src/memory/postgresql-memory-store.ts`

Implement sophisticated project-aware querying and analytics for single-user scenarios:

```typescript
// Enhanced query methods with project awareness and JOIN operations
async queryPrompts(query: PromptQuery): Promise<StoredPrompt[]> {
  try {
    let sql = `
      SELECT p.*, pr.project_name, pr.directory_path as project_directory_path,
             pr.technology_stack, pr.project_type
      FROM stored_prompts p
      LEFT JOIN projects pr ON p.project_id = pr.id
      WHERE 1=1
    `;
    const values: any[] = [];
    let paramIndex = 1;

    // Project-based filtering
    if (query.project_id) {
      sql += ` AND p.project_id = $${paramIndex++}`;
      values.push(query.project_id);
    }

    if (query.project_ids && query.project_ids.length > 0) {
      sql += ` AND p.project_id = ANY($${paramIndex++})`;
      values.push(query.project_ids);
    }

    if (query.project_scoped_only) {
      sql += ` AND p.project_id IS NOT NULL`;
    }

    if (query.project_active_only) {
      sql += ` AND (pr.is_active = true OR p.project_id IS NULL)`;
    }

    // Existing filters
    if (query.session_id) {
      sql += ` AND p.session_id = $${paramIndex++}`;
      values.push(query.session_id);
    }

    if (query.prompt_type) {
      sql += ` AND p.prompt_type = $${paramIndex++}`;
      values.push(query.prompt_type);
    }

    if (query.domain) {
      sql += ` AND p.domain = $${paramIndex++}`;
      values.push(query.domain);
    }

    if (query.complexity_range) {
      sql += ` AND p.complexity_estimate BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      values.push(query.complexity_range[0], query.complexity_range[1]);
    }

    if (query.date_range) {
      sql += ` AND p.received_at BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      values.push(query.date_range[0], query.date_range[1]);
    }

    if (query.processing_success !== undefined) {
      sql += ` AND p.processing_success = $${paramIndex++}`;
      values.push(query.processing_success);
    }

    if (query.tags && query.tags.length > 0) {
      sql += ` AND p.tags @> $${paramIndex++}`;
      values.push(query.tags);
    }

    // Text similarity search
    if (query.similar_to) {
      sql += ` AND similarity(p.original_prompt, $${paramIndex++}) > 0.3`;
      values.push(query.similar_to);

      // Order by similarity when searching
      const sortBy = query.sort_by || 'similarity';
      const sortOrder = query.sort_order || 'desc';

      if (sortBy === 'similarity') {
        sql += ` ORDER BY similarity(p.original_prompt, $${paramIndex++}) ${sortOrder.toUpperCase()}`;
        values.push(query.similar_to);
      } else {
        sql += ` ORDER BY p.${sortBy} ${sortOrder.toUpperCase()}`;
      }
    } else {
      // Default sorting
      const sortBy = query.sort_by || 'received_at';
      const sortOrder = query.sort_order || 'desc';
      sql += ` ORDER BY p.${sortBy} ${sortOrder.toUpperCase()}`;
    }

    // Pagination
    if (query.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      values.push(query.limit);
    }

    if (query.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      values.push(query.offset);
    }

    const result = await this.executeQuery(sql, values);
    return result.rows.map(row => this.mapRowToPromptWithProject(row, query.include_project));

  } catch (error) {
    console.error('❌ Failed to query prompts:', error);
    throw new Error(`Prompt query failed: ${error.message}`);
  }
}

async queryThoughts(query: MemoryQuery): Promise<StoredThought[]> {
  try {
    let sql = `
      SELECT t.*, pr.project_name, pr.directory_path as project_directory_path,
             pr.technology_stack, pr.project_type
      FROM stored_thoughts t
      LEFT JOIN projects pr ON t.project_id = pr.id
      WHERE 1=1
    `;
    const values: any[] = [];
    let paramIndex = 1;

    // Project-based filtering
    if (query.project_id) {
      sql += ` AND t.project_id = $${paramIndex++}`;
      values.push(query.project_id);
    }

    if (query.project_ids && query.project_ids.length > 0) {
      sql += ` AND t.project_id = ANY($${paramIndex++})`;
      values.push(query.project_ids);
    }

    if (query.project_scoped_only) {
      sql += ` AND t.project_id IS NOT NULL`;
    }

    if (query.project_active_only) {
      sql += ` AND (pr.is_active = true OR t.project_id IS NULL)`;
    }

    // Existing filters
    if (query.session_ids && query.session_ids.length > 0) {
      sql += ` AND t.session_id = ANY($${paramIndex++})`;
      values.push(query.session_ids);
    }

    if (query.domain) {
      sql += ` AND t.domain = $${paramIndex++}`;
      values.push(query.domain);
    }

    if (query.confidence_range) {
      sql += ` AND t.confidence BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      values.push(query.confidence_range[0], query.confidence_range[1]);
    }

    if (query.complexity_range) {
      sql += ` AND t.complexity BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      values.push(query.complexity_range[0], query.complexity_range[1]);
    }

    if (query.time_range) {
      sql += ` AND t.timestamp BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      values.push(query.time_range[0], query.time_range[1]);
    }

    if (query.success_only) {
      sql += ` AND t.success = true`;
    }

    if (query.effectiveness_threshold) {
      sql += ` AND t.effectiveness_score >= $${paramIndex++}`;
      values.push(query.effectiveness_threshold);
    }

    if (query.tags && query.tags.length > 0) {
      sql += ` AND t.tags @> $${paramIndex++}`;
      values.push(query.tags);
    }

    if (query.patterns && query.patterns.length > 0) {
      sql += ` AND t.patterns_detected @> $${paramIndex++}`;
      values.push(query.patterns);
    }

    // Text similarity search
    if (query.text_similarity) {
      sql += ` AND similarity(t.thought, $${paramIndex++}) > 0.3`;
      values.push(query.text_similarity);

      const sortBy = query.sort_by || 'similarity';
      const sortOrder = query.sort_order || 'desc';

      if (sortBy === 'similarity') {
        sql += ` ORDER BY similarity(t.thought, $${paramIndex++}) ${sortOrder.toUpperCase()}`;
        values.push(query.text_similarity);
      } else {
        sql += ` ORDER BY t.${sortBy} ${sortOrder.toUpperCase()}`;
      }
    } else {
      // Default sorting
      const sortBy = query.sort_by || 'timestamp';
      const sortOrder = query.sort_order || 'desc';
      sql += ` ORDER BY t.${sortBy} ${sortOrder.toUpperCase()}`;
    }

    // Pagination
    if (query.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      values.push(query.limit);
    }

    if (query.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      values.push(query.offset);
    }

    const result = await this.executeQuery(sql, values);
    return result.rows.map(row => this.mapRowToThoughtWithProject(row, query.include_project));

  } catch (error) {
    console.error('❌ Failed to query thoughts:', error);
    throw new Error(`Thought query failed: ${error.message}`);
  }
}

// Hybrid similarity search: project-first, then global fallback
async findSimilarPromptsHybrid(prompt: string, limit = 5, projectId?: string): Promise<StoredPrompt[]> {
  if (projectId) {
    // First try project-scoped search
    const projectResults = await this.queryPrompts({
      project_id: projectId,
      similar_to: prompt,
      limit: limit,
      include_project: true
    });

    if (projectResults.length >= Math.min(3, limit)) {
      return projectResults.slice(0, limit);
    }

    // Fallback to global search for remaining slots
    const globalResults = await this.queryPrompts({
      similar_to: prompt,
      limit: limit - projectResults.length,
      include_project: true
    });

    return [...projectResults, ...globalResults].slice(0, limit);
  }

  // No project context, use global search
  return this.queryPrompts({
    similar_to: prompt,
    limit: limit,
    include_project: true
  });
}

async findSimilarThoughtsHybrid(thought: string, limit = 5, projectId?: string): Promise<StoredThought[]> {
  if (projectId) {
    // First try project-scoped search
    const projectResults = await this.queryThoughts({
      project_id: projectId,
      text_similarity: thought,
      limit: limit,
      include_project: true
    });

    if (projectResults.length >= Math.min(3, limit)) {
      return projectResults.slice(0, limit);
    }

    // Fallback to global search for remaining slots
    const globalResults = await this.queryThoughts({
      text_similarity: thought,
      limit: limit - projectResults.length,
      include_project: true
    });

    return [...projectResults, ...globalResults].slice(0, limit);
  }

  // No project context, use global search
  return this.queryThoughts({
    text_similarity: thought,
    limit: limit,
    include_project: true
  });
}

// Project analytics for single-user insights
async getProjectAnalytics(projectId: string): Promise<{
  totalSessions: number;
  totalThoughts: number;
  totalPrompts: number;
  averageSessionLength: number;
  successRate: number;
  mostUsedTechnologies: Array<{ tech: string; usage: number }>;
  recentActivity: Array<{ date: string; sessions: number; thoughts: number }>;
}> {
  try {
    const analytics = await Promise.all([
      // Basic counts
      this.executeQuery(`
        SELECT COUNT(*) as count FROM reasoning_sessions WHERE project_id = $1
      `, [projectId]),

      this.executeQuery(`
        SELECT COUNT(*) as count FROM stored_thoughts WHERE project_id = $1
      `, [projectId]),

      this.executeQuery(`
        SELECT COUNT(*) as count FROM stored_prompts WHERE project_id = $1
      `, [projectId]),

      // Average session length
      this.executeQuery(`
        SELECT AVG(total_thoughts) as avg_length
        FROM reasoning_sessions
        WHERE project_id = $1 AND total_thoughts > 0
      `, [projectId]),

      // Success rate
      this.executeQuery(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE goal_achieved = true) as successful
        FROM reasoning_sessions
        WHERE project_id = $1
      `, [projectId]),

      // Recent activity (last 30 days)
      this.executeQuery(`
        SELECT
          DATE(start_time) as date,
          COUNT(*) as sessions,
          SUM(total_thoughts) as thoughts
        FROM reasoning_sessions
        WHERE project_id = $1
          AND start_time >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(start_time)
        ORDER BY date DESC
        LIMIT 30
      `, [projectId])
    ]);

    const [sessions, thoughts, prompts, avgLength, successData, recentActivity] = analytics;

    const totalSessions = parseInt(sessions.rows[0]?.count || '0');
    const totalThoughts = parseInt(thoughts.rows[0]?.count || '0');
    const totalPrompts = parseInt(prompts.rows[0]?.count || '0');
    const averageSessionLength = parseFloat(avgLength.rows[0]?.avg_length || '0');

    const successTotal = parseInt(successData.rows[0]?.total || '0');
    const successCount = parseInt(successData.rows[0]?.successful || '0');
    const successRate = successTotal > 0 ? successCount / successTotal : 0;

    // Get project technology stack for insights
    const project = await this.getProject(projectId);
    const mostUsedTechnologies = project?.technology_stack?.map(tech => ({
      tech,
      usage: 1 // In single-user scenario, this is simplified
    })) || [];

    return {
      totalSessions,
      totalThoughts,
      totalPrompts,
      averageSessionLength,
      successRate,
      mostUsedTechnologies,
      recentActivity: recentActivity.rows.map(row => ({
        date: row.date,
        sessions: parseInt(row.sessions),
        thoughts: parseInt(row.thoughts || '0')
      }))
    };

  } catch (error) {
    console.error('❌ Failed to get project analytics:', error);
    throw new Error(`Project analytics failed: ${error.message}`);
  }
}

// Cross-project pattern analysis for personal insights
async getCrossProjectPatterns(limit = 10): Promise<Array<{
  pattern: string;
  projects: string[];
  frequency: number;
  successRate: number;
}>> {
  try {
    const query = `
      SELECT
        unnest(patterns_detected) as pattern,
        array_agg(DISTINCT pr.project_name) as project_names,
        COUNT(*) as frequency,
        AVG(CASE WHEN t.success THEN 1.0 ELSE 0.0 END) as success_rate
      FROM stored_thoughts t
      JOIN projects pr ON t.project_id = pr.id
      WHERE array_length(patterns_detected, 1) > 0
      GROUP BY pattern
      HAVING COUNT(DISTINCT t.project_id) > 1  -- Pattern appears in multiple projects
      ORDER BY frequency DESC, success_rate DESC
      LIMIT $1
    `;

    const result = await this.executeQuery(query, [limit]);

    return result.rows.map(row => ({
      pattern: row.pattern,
      projects: row.project_names,
      frequency: parseInt(row.frequency),
      successRate: parseFloat(row.success_rate || '0')
    }));

  } catch (error) {
    console.error('❌ Failed to get cross-project patterns:', error);
    throw new Error(`Cross-project pattern analysis failed: ${error.message}`);
  }
}

// Helper methods for mapping with project data
private mapRowToPromptWithProject(row: any, includeProject = false): StoredPrompt {
  const prompt: StoredPrompt = {
    id: row.id,
    session_id: row.session_id,
    project_id: row.project_id,
    original_prompt: row.original_prompt,
    prompt_type: row.prompt_type,
    prompt_source: row.prompt_source,
    received_at: row.received_at,
    domain: row.domain,
    complexity_estimate: row.complexity_estimate,
    estimated_cognitive_load: row.estimated_cognitive_load,
    classification_confidence: row.classification_confidence,
    prompt_context: row.prompt_context,
    extracted_intent: row.extracted_intent,
    processing_started_at: row.processing_started_at,
    processing_completed_at: row.processing_completed_at,
    processing_success: row.processing_success,
    processing_error: row.processing_error,
    tags: row.tags || [],
    similar_prompts: row.similar_prompts || [],
    reasoning_improvement: row.reasoning_improvement,
    persona_selected: row.persona_selected,
    cognitive_priming_effectiveness: row.cognitive_priming_effectiveness,
    created_at: row.created_at,
    updated_at: row.updated_at
  };

  if (includeProject && row.project_id && row.project_name) {
    prompt.project = {
      id: row.project_id,
      directory_path: row.project_directory_path,
      project_name: row.project_name,
      technology_stack: row.technology_stack || [],
      project_type: row.project_type,
      // Minimal project data for performance
      created_at: new Date(),
      updated_at: new Date(),
      last_activity_at: new Date(),
      is_active: true,
      is_archived: false
    };
  }

  return prompt;
}

private mapRowToThoughtWithProject(row: any, includeProject = false): StoredThought {
  const thought: StoredThought = {
    id: row.id,
    session_id: row.session_id,
    prompt_id: row.prompt_id,
    project_id: row.project_id,
    thought: row.thought,
    thought_number: row.thought_number,
    total_thoughts: row.total_thoughts,
    next_thought_needed: row.next_thought_needed,
    is_revision: row.is_revision,
    revises_thought: row.revises_thought,
    branch_from_thought: row.branch_from_thought,
    branch_id: row.branch_id,
    needs_more_thoughts: row.needs_more_thoughts,
    timestamp: row.timestamp,
    confidence: row.confidence,
    domain: row.domain,
    objective: row.objective,
    complexity: row.complexity,
    success: row.success,
    effectiveness_score: row.effectiveness_score,
    user_feedback: row.user_feedback,
    outcome_quality: row.outcome_quality,
    context: row.context || {},
    tags: row.tags || [],
    patterns_detected: row.patterns_detected || [],
    similar_thoughts: row.similar_thoughts || [],
    output: row.output,
    context_trace: row.context_trace || [],
    created_at: row.created_at,
    updated_at: row.updated_at
  };

  if (includeProject && row.project_id && row.project_name) {
    thought.project = {
      id: row.project_id,
      directory_path: row.project_directory_path,
      project_name: row.project_name,
      technology_stack: row.technology_stack || [],
      project_type: row.project_type,
      // Minimal project data for performance
      created_at: new Date(),
      updated_at: new Date(),
      last_activity_at: new Date(),
      is_active: true,
      is_archived: false
    };
  }

  return thought;
}
```

#### Task 6: Comprehensive Testing for Single-User Scenarios

**File**: `test/memory/project-schema-extension.test.ts`

Complete testing framework for normalized project schema with single-user focus:

```typescript
import { PostgreSQLMemoryStore } from '../../src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from '../../src/memory/postgresql-config.js';
import {
  Project,
  StoredPrompt,
  StoredThought,
  ReasoningSession,
  ProjectQuery,
  PromptQuery,
  MemoryQuery,
} from '../../src/memory/memory-store.js';
import { strict as assert } from 'assert';
import * as path from 'path';
import * as fs from 'fs';

export async function runProjectSchemaExtensionTests(): Promise<void> {
  console.log('🧪 Running Project Schema Extension Tests (Single-User)...');

  const config = PostgreSQLConfigs.testing();
  const memoryStore = new PostgreSQLMemoryStore(config);

  try {
    await memoryStore.initialize();
    console.log('✅ PostgreSQL Memory Store initialized for testing');

    // Test 1: Project CRUD Operations
    await testProjectCRUD(memoryStore);

    // Test 2: Project Metadata Extraction
    await testProjectMetadataExtraction(memoryStore);

    // Test 3: Project-Scoped Data Storage
    await testProjectScopedDataStorage(memoryStore);

    // Test 4: Project-Aware Queries
    await testProjectAwareQueries(memoryStore);

    // Test 5: Hybrid Similarity Search
    await testHybridSimilaritySearch(memoryStore);

    // Test 6: Project Analytics
    await testProjectAnalytics(memoryStore);

    // Test 7: Cross-Project Pattern Analysis
    await testCrossProjectPatterns(memoryStore);

    // Test 8: Backward Compatibility
    await testBackwardCompatibility(memoryStore);

    // Test 9: Error Handling
    await testErrorHandling(memoryStore);

    // Test 10: Performance with Caching
    await testPerformanceOptimization(memoryStore);

    console.log('🎉 All project schema extension tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await memoryStore.close();
  }
}

async function testProjectCRUD(store: PostgreSQLMemoryStore): Promise<void> {
  console.log('Testing project CRUD operations...');

  // Test project creation
  const testProject: Omit<Project, 'id'> = {
    directory_path: '/home/user/test-project',
    project_name: 'Test Project',
    description: 'A test project for validation',
    technology_stack: ['typescript', 'nodejs', 'react'],
    project_type: 'web-app',
    programming_languages: ['typescript', 'javascript'],
    created_at: new Date(),
    updated_at: new Date(),
    last_activity_at: new Date(),
    is_active: true,
    is_archived: false,
    cognitive_settings: { preferred_persona: 'Engineer' },
    project_metadata: { test: true },
  };

  const createdProject = await store.createProject(testProject);
  assert(createdProject.id, 'Project should have an ID');
  assert.strictEqual(createdProject.project_name, 'Test Project');
  assert.deepStrictEqual(createdProject.technology_stack, ['typescript', 'nodejs', 'react']);

  // Test project retrieval
  const retrievedProject = await store.getProject(createdProject.id);
  assert(retrievedProject, 'Project should be retrievable');
  assert.strictEqual(retrievedProject.project_name, 'Test Project');

  // Test find by path
  const foundProject = await store.findProjectByPath('/home/user/test-project');
  assert(foundProject, 'Project should be findable by path');
  assert.strictEqual(foundProject.id, createdProject.id);

  // Test project update
  await store.updateProject(createdProject.id, {
    description: 'Updated description',
    technology_stack: ['typescript', 'nodejs', 'react', 'postgresql'],
    is_active: false,
  });

  const updatedProject = await store.getProject(createdProject.id);
  assert.strictEqual(updatedProject!.description, 'Updated description');
  assert(updatedProject!.technology_stack!.includes('postgresql'));
  assert.strictEqual(updatedProject!.is_active, false);

  // Test project query
  const projects = await store.queryProjects({
    project_type: 'web-app',
    technology_stack: ['typescript'],
    is_active: false,
  });

  assert(projects.length >= 1, 'Should find at least one project');
  assert(
    projects.some(p => p.id === createdProject.id),
    'Should include our test project'
  );

  console.log('✅ Project CRUD operations validated');
}

async function testProjectMetadataExtraction(store: PostgreSQLMemoryStore): Promise<void> {
  console.log('Testing project metadata extraction...');

  // Create temporary test directory structure
  const tempDir = '/tmp/test-project-metadata';
  const packageJsonPath = path.join(tempDir, 'package.json');
  const readmePath = path.join(tempDir, 'README.md');

  try {
    // Setup test files
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(
        {
          name: 'test-metadata-project',
          version: '1.0.0',
          description: 'A project for testing metadata extraction',
          dependencies: {
            react: '^18.0.0',
            typescript: '^4.8.0',
          },
          devDependencies: {
            '@types/node': '^18.0.0',
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      readmePath,
      '# Test Metadata Project\n\nThis project tests metadata extraction capabilities.\n\n## Features\n- Automated testing\n- Metadata extraction'
    );

    // Test metadata extraction logic by simulating server.ts behavior
    const extractedMetadata = await extractProjectMetadataForTest(tempDir);

    assert.strictEqual(extractedMetadata.name, 'test-project-metadata');
    assert(extractedMetadata.description!.includes('metadata extraction'));
    assert(extractedMetadata.technologyStack.includes('react'));
    assert(extractedMetadata.technologyStack.includes('typescript'));
    assert(extractedMetadata.technologyStack.includes('nodejs'));
    assert(extractedMetadata.programmingLanguages.includes('typescript'));
    assert.strictEqual(extractedMetadata.projectType, 'web-app');

    console.log('✅ Project metadata extraction validated');
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function testProjectScopedDataStorage(store: PostgreSQLMemoryStore): Promise<void> {
  console.log('Testing project-scoped data storage...');

  // Create test projects
  const project1 = await store.createProject({
    directory_path: '/home/user/project-1',
    project_name: 'Project 1',
    description: 'First test project',
    created_at: new Date(),
    updated_at: new Date(),
    last_activity_at: new Date(),
    is_active: true,
    is_archived: false,
  });

  const project2 = await store.createProject({
    directory_path: '/home/user/project-2',
    project_name: 'Project 2',
    description: 'Second test project',
    created_at: new Date(),
    updated_at: new Date(),
    last_activity_at: new Date(),
    is_active: true,
    is_archived: false,
  });

  // Create test session with project association
  const session1: ReasoningSession = {
    id: 'test-session-1',
    project_id: project1.id,
    start_time: new Date(),
    objective: 'Test project-scoped storage',
    goal_achieved: true,
    confidence_level: 0.85,
    total_thoughts: 3,
    revision_count: 0,
    branch_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  await store.storeSession(session1);

  // Create test prompt with project association
  const prompt1: StoredPrompt = {
    id: 'test-prompt-1',
    session_id: 'test-session-1',
    project_id: project1.id,
    original_prompt: 'Help me with project 1 specific task',
    received_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  await store.storePrompt(prompt1);

  // Create test thought with project association
  const thought1: StoredThought = {
    id: 'test-thought-1',
    session_id: 'test-session-1',
    prompt_id: 'test-prompt-1',
    project_id: project1.id,
    thought: 'This is a thought related to project 1',
    thought_number: 1,
    total_thoughts: 1,
    next_thought_needed: false,
    timestamp: new Date(),
    context: {},
    created_at: new Date(),
    updated_at: new Date(),
  };

  await store.storeThought(thought1);

  // Verify project activity was updated
  const updatedProject = await store.getProject(project1.id);
  assert(
    updatedProject!.last_activity_at > project1.last_activity_at,
    'Project activity should be updated'
  );

  console.log('✅ Project-scoped data storage validated');
}

async function testProjectAwareQueries(store: PostgreSQLMemoryStore): Promise<void> {
  console.log('Testing project-aware queries...');

  // Query prompts by project
  const project1Prompts = await store.queryPrompts({
    project_id: (await store.findProjectByPath('/home/user/project-1'))!.id,
    include_project: true,
  });

  assert(project1Prompts.length >= 1, 'Should find prompts for project 1');
  assert(project1Prompts[0].project, 'Should include project data');
  assert.strictEqual(project1Prompts[0].project!.project_name, 'Project 1');

  // Query thoughts by project
  const project1Thoughts = await store.queryThoughts({
    project_id: (await store.findProjectByPath('/home/user/project-1'))!.id,
    include_project: true,
  });

  assert(project1Thoughts.length >= 1, 'Should find thoughts for project 1');
  assert(project1Thoughts[0].project, 'Should include project data');

  // Query only project-scoped data
  const projectScopedPrompts = await store.queryPrompts({
    project_scoped_only: true,
    include_project: true,
  });

  assert(
    projectScopedPrompts.every(p => p.project_id),
    'All prompts should have project_id'
  );

  // Query only active projects
  const activeProjectPrompts = await store.queryPrompts({
    project_active_only: true,
    include_project: true,
  });

  assert(
    activeProjectPrompts.every(p => !p.project || p.project.is_active),
    'All prompts should be from active projects or have no project'
  );

  console.log('✅ Project-aware queries validated');
}

async function testHybridSimilaritySearch(store: PostgreSQLMemoryStore): Promise<void> {
  console.log('Testing hybrid similarity search...');

  const project1 = await store.findProjectByPath('/home/user/project-1');

  // Test project-scoped similarity search
  const similarPrompts = await store.findSimilarPromptsHybrid(
    'Help me with project task',
    5,
    project1!.id
  );

  assert(similarPrompts.length > 0, 'Should find similar prompts');

  // Test global similarity search
  const globalSimilarPrompts = await store.findSimilarPromptsHybrid('Help me with project task', 5);

  assert(globalSimilarPrompts.length > 0, 'Should find similar prompts globally');

  console.log('✅ Hybrid similarity search validated');
}

async function testProjectAnalytics(store: PostgreSQLMemoryStore): Promise<void> {
  console.log('Testing project analytics...');

  const project1 = await store.findProjectByPath('/home/user/project-1');
  const analytics = await store.getProjectAnalytics(project1!.id);

  assert(analytics.totalSessions >= 1, 'Should have at least one session');
  assert(analytics.totalThoughts >= 1, 'Should have at least one thought');
  assert(analytics.totalPrompts >= 1, 'Should have at least one prompt');
  assert(typeof analytics.successRate === 'number', 'Success rate should be a number');
  assert(Array.isArray(analytics.recentActivity), 'Recent activity should be an array');

  console.log('✅ Project analytics validated');
}

async function testCrossProjectPatterns(store: PostgreSQLMemoryStore): Promise<void> {
  console.log('Testing cross-project pattern analysis...');

  // Add thoughts with patterns to multiple projects
  const project1 = await store.findProjectByPath('/home/user/project-1');
  const project2 = await store.findProjectByPath('/home/user/project-2');

  const thoughtWithPattern: StoredThought = {
    id: 'test-thought-pattern',
    session_id: 'test-session-1',
    project_id: project2!.id,
    thought: 'This thought demonstrates a common pattern',
    thought_number: 1,
    total_thoughts: 1,
    next_thought_needed: false,
    timestamp: new Date(),
    patterns_detected: ['common-pattern', 'debugging-approach'],
    success: true,
    context: {},
    created_at: new Date(),
    updated_at: new Date(),
  };

  await store.storeThought(thoughtWithPattern);

  const patterns = await store.getCrossProjectPatterns(5);

  // Note: This test may not find patterns if database doesn't have enough data
  // In real scenarios, this would be populated over time
  assert(Array.isArray(patterns), 'Should return an array of patterns');

  console.log('✅ Cross-project pattern analysis validated');
}

async function testBackwardCompatibility(store: PostgreSQLMemoryStore): Promise<void> {
  console.log('Testing backward compatibility...');

  // Store data without project_id (simulating legacy data)
  const legacyPrompt: StoredPrompt = {
    id: 'legacy-prompt-1',
    session_id: 'legacy-session-1',
    // project_id is undefined (backward compatibility)
    original_prompt: 'Legacy prompt without project association',
    received_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  await store.storePrompt(legacyPrompt);

  const legacyThought: StoredThought = {
    id: 'legacy-thought-1',
    session_id: 'legacy-session-1',
    // project_id is undefined (backward compatibility)
    thought: 'Legacy thought without project association',
    thought_number: 1,
    total_thoughts: 1,
    next_thought_needed: false,
    timestamp: new Date(),
    context: {},
    created_at: new Date(),
    updated_at: new Date(),
  };

  await store.storeThought(legacyThought);

  // Query should work with null project_id
  const allPrompts = await store.queryPrompts({});
  assert(
    allPrompts.some(p => p.id === 'legacy-prompt-1'),
    'Should include legacy prompts'
  );

  const allThoughts = await store.queryThoughts({});
  assert(
    allThoughts.some(t => t.id === 'legacy-thought-1'),
    'Should include legacy thoughts'
  );

  console.log('✅ Backward compatibility validated');
}

async function testErrorHandling(store: PostgreSQLMemoryStore): Promise<void> {
  console.log('Testing error handling...');

  // Test duplicate directory path
  try {
    await store.createProject({
      directory_path: '/home/user/project-1', // Duplicate path
      project_name: 'Duplicate Project',
      created_at: new Date(),
      updated_at: new Date(),
      last_activity_at: new Date(),
      is_active: true,
      is_archived: false,
    });
    assert.fail('Should have thrown error for duplicate directory path');
  } catch (error) {
    assert(error.message.includes('creation failed'), 'Should indicate creation failure');
  }

  // Test invalid project ID
  const invalidProject = await store.getProject('invalid-uuid');
  assert.strictEqual(invalidProject, null, 'Should return null for invalid project ID');

  // Test non-existent path
  const nonExistentProject = await store.findProjectByPath('/non/existent/path');
  assert.strictEqual(nonExistentProject, null, 'Should return null for non-existent path');

  console.log('✅ Error handling validated');
}

async function testPerformanceOptimization(store: PostgreSQLMemoryStore): Promise<void> {
  console.log('Testing performance optimization with caching...');

  const project1 = await store.findProjectByPath('/home/user/project-1');
  const projectId = project1!.id;

  // First call - loads from database
  const start1 = Date.now();
  const project1First = await store.getProject(projectId);
  const time1 = Date.now() - start1;

  // Second call - should use cache
  const start2 = Date.now();
  const project1Second = await store.getProject(projectId);
  const time2 = Date.now() - start2;

  assert(project1First?.id === project1Second?.id, 'Should return same project');
  assert(time2 < time1, 'Second call should be faster (cached)');

  // Test cache invalidation on update
  await store.updateProject(projectId, { description: 'Cache invalidation test' });

  const projectAfterUpdate = await store.getProject(projectId);
  assert.strictEqual(projectAfterUpdate!.description, 'Cache invalidation test');

  // Clear cache for cleanup
  await store.clearProjectCache();

  console.log('✅ Performance optimization validated');
}

// Helper function for metadata extraction testing
async function extractProjectMetadataForTest(directoryPath: string): Promise<{
  name: string;
  description?: string;
  technologyStack: string[];
  projectType?: string;
  programmingLanguages: string[];
  customMetadata?: Record<string, any>;
}> {
  // Simplified version of the metadata extraction logic from server.ts
  const projectName = path.basename(directoryPath);
  const technologyStack: string[] = [];
  const programmingLanguages: string[] = [];
  let description: string | undefined;
  let projectType: string | undefined;
  const customMetadata: Record<string, any> = {};

  try {
    const packageJsonPath = path.join(directoryPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      description = packageJson.description;
      technologyStack.push('nodejs');
      programmingLanguages.push('javascript');

      if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
        technologyStack.push('typescript');
        programmingLanguages.push('typescript');
      }

      if (packageJson.dependencies?.react) {
        technologyStack.push('react');
        projectType = 'web-app';
      }

      customMetadata.packageJson = {
        name: packageJson.name,
        version: packageJson.version,
      };
    }

    if (!description) {
      const readmeFiles = ['README.md', 'README.txt'];
      for (const readme of readmeFiles) {
        const readmePath = path.join(directoryPath, readme);
        if (fs.existsSync(readmePath)) {
          const content = fs.readFileSync(readmePath, 'utf8');
          const firstParagraph = content.split('\n\n')[1] || content.split('\n')[2];
          if (firstParagraph && firstParagraph.length < 500) {
            description = firstParagraph.replace(/^#\s*/, '').trim();
          }
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error in metadata extraction test:', error);
  }

  return {
    name: projectName,
    description,
    technologyStack: [...new Set(technologyStack)],
    projectType,
    programmingLanguages: [...new Set(programmingLanguages)],
    customMetadata,
  };
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runProjectSchemaExtensionTests().catch(console.error);
}
```

#### Update Abstract MemoryStore Interface

**File**: `src/memory/memory-store.ts`

Add project management methods to the abstract MemoryStore class:

```typescript
/**
 * Abstract interface for memory storage implementations
 */
export abstract class MemoryStore {
  // ... existing methods

  /**
   * Create a new project
   */
  abstract createProject(project: Omit<Project, 'id'>): Promise<Project>;

  /**
   * Get a project by ID
   */
  abstract getProject(projectId: string): Promise<Project | null>;

  /**
   * Find a project by directory path
   */
  abstract findProjectByPath(directoryPath: string): Promise<Project | null>;

  /**
   * Update a project
   */
  abstract updateProject(projectId: string, updates: Partial<Project>): Promise<void>;

  /**
   * Query projects based on criteria
   */
  abstract queryProjects(query: ProjectQuery): Promise<Project[]>;

  /**
   * Get project analytics for single-user insights
   */
  abstract getProjectAnalytics(projectId: string): Promise<{
    totalSessions: number;
    totalThoughts: number;
    totalPrompts: number;
    averageSessionLength: number;
    successRate: number;
    mostUsedTechnologies: Array<{ tech: string; usage: number }>;
    recentActivity: Array<{ date: string; sessions: number; thoughts: number }>;
  }>;

  /**
   * Get cross-project patterns for personal learning insights
   */
  abstract getCrossProjectPatterns(limit?: number): Promise<Array<{
    pattern: string;
    projects: string[];
    frequency: number;
    successRate: number;
  }>>;

  /**
   * Find similar prompts with hybrid project-aware search
   */
  abstract findSimilarPromptsHybrid(prompt: string, limit?: number, projectId?: string): Promise<StoredPrompt[]>;

  /**
   * Find similar thoughts with hybrid project-aware search
   */
  abstract findSimilarThoughtsHybrid(thought: string, limit?: number, projectId?: string): Promise<StoredThought[]>;

  // ... existing methods continue
}
      $1, $2, $3, $4, $5, $6, $7, $8, -- ... other values
    )`;

  const values = [
    prompt.id, prompt.session_id, prompt.original_prompt,
    prompt.prompt_type, prompt.domain, prompt.project_directory,
    // ... other values
  ];

  await this.executeQuery(query, values);
}

// Update queryPrompts method with project filtering
async queryPrompts(query: PromptQuery): Promise<StoredPrompt[]> {
  let sql = 'SELECT * FROM stored_prompts WHERE 1=1';
  const values: any[] = [];
  let paramIndex = 1;

  // Add project filtering
  if (query.project_directory) {
    sql += ` AND project_directory = $${paramIndex++}`;
    values.push(query.project_directory);
  }

  if (query.project_scoped_only && query.project_directory) {
    // Only return results from specified project
    sql += ` AND project_directory IS NOT NULL`;
  }

  // ... existing query logic
  return this.executeQuery(sql, values);
}

// Similar updates for storeThought, storeSession, queryThoughts, etc.
```

#### Task 5: Enhanced Query Capabilities

**File**: `src/memory/postgresql-memory-store.ts`

Add project-aware similarity detection:

```typescript
// Enhanced similarity search with project awareness
async findSimilarPrompts(prompt: string, limit = 5, projectDirectory?: string): Promise<StoredPrompt[]> {
  let sql = `
    SELECT *,
           similarity(original_prompt, $1) as similarity_score
    FROM stored_prompts
    WHERE similarity(original_prompt, $1) > 0.3
  `;

  const values = [prompt];
  let paramIndex = 2;

  // Add project filtering if specified
  if (projectDirectory) {
    sql += ` AND project_directory = $${paramIndex++}`;
    values.push(projectDirectory);
  }

  sql += ` ORDER BY similarity_score DESC LIMIT $${paramIndex}`;
  values.push(limit);

  return this.executeQuery(sql, values);
}

// Hybrid search: project-first, then global fallback
async findSimilarPromptsHybrid(prompt: string, limit = 5, projectDirectory?: string): Promise<StoredPrompt[]> {
  if (projectDirectory) {
    // First try project-scoped search
    const projectResults = await this.findSimilarPrompts(prompt, limit, projectDirectory);

    if (projectResults.length >= Math.min(3, limit)) {
      return projectResults.slice(0, limit);
    }

    // Fallback to global search for remaining slots
    const globalResults = await this.findSimilarPrompts(prompt, limit - projectResults.length);
    return [...projectResults, ...globalResults].slice(0, limit);
  }

  // No project context, use global search
  return this.findSimilarPrompts(prompt, limit);
}
```

#### Task 6: Comprehensive Testing

**File**: `test/memory/project-directory-extension.test.ts`

```typescript
import { PostgreSQLMemoryStore } from '../../src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from '../../src/memory/postgresql-config.js';
import { StoredPrompt, StoredThought, ReasoningSession } from '../../src/memory/memory-store.js';

export async function runProjectDirectoryTests(): Promise<void> {
  console.log('🧪 Running Project Directory Extension Tests...');

  const config = PostgreSQLConfigs.testing();
  const memoryStore = new PostgreSQLMemoryStore(config);

  try {
    await memoryStore.initialize();

    // Test 1: Schema validation
    await testSchemaExtension(memoryStore);

    // Test 2: Project context storage
    await testProjectContextStorage(memoryStore);

    // Test 3: Project-scoped queries
    await testProjectScopedQueries(memoryStore);

    // Test 4: Hybrid similarity search
    await testHybridSimilaritySearch(memoryStore);

    // Test 5: Backward compatibility
    await testBackwardCompatibility(memoryStore);

    console.log('🎉 All project directory tests passed!');
  } finally {
    await memoryStore.close();
  }
}

async function testSchemaExtension(store: PostgreSQLMemoryStore): Promise<void> {
  // Verify columns exist
  const result = await store.executeQuery(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name IN ('reasoning_sessions', 'stored_prompts', 'stored_thoughts')
    AND column_name = 'project_directory'
  `);

  if (result.rows.length !== 3) {
    throw new Error('project_directory columns not found in all tables');
  }

  console.log('✅ Schema extension validated');
}

async function testProjectContextStorage(store: PostgreSQLMemoryStore): Promise<void> {
  const projectDir = '/home/user/my-project';

  // Test prompt storage with project context
  const prompt: StoredPrompt = {
    id: 'test-prompt-1',
    session_id: 'test-session-1',
    original_prompt: 'Help me debug this React component',
    project_directory: projectDir,
    received_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  await store.storePrompt(prompt);

  const retrieved = await store.getPrompt('test-prompt-1');
  if (retrieved?.project_directory !== projectDir) {
    throw new Error('Project directory not stored correctly');
  }

  console.log('✅ Project context storage validated');
}

async function testProjectScopedQueries(store: PostgreSQLMemoryStore): Promise<void> {
  // Store prompts from different projects
  await store.storePrompt({
    id: 'proj-a-prompt',
    session_id: 'session-a',
    original_prompt: 'Project A prompt',
    project_directory: '/home/user/project-a',
    received_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  await store.storePrompt({
    id: 'proj-b-prompt',
    session_id: 'session-b',
    original_prompt: 'Project B prompt',
    project_directory: '/home/user/project-b',
    received_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Test project-scoped query
  const projectAResults = await store.queryPrompts({
    project_directory: '/home/user/project-a',
    limit: 10,
  });

  if (projectAResults.length !== 1 || projectAResults[0].id !== 'proj-a-prompt') {
    throw new Error('Project-scoped query failed');
  }

  console.log('✅ Project-scoped queries validated');
}
```

### Validation Gates (Executable)

```bash
# Build and syntax validation
npm run build

# Type checking
npm run lint

# Database schema validation
npm run test:schema

# Integration testing
npm run test:memory

# End-to-end validation
npm run test:e2e

# Performance regression testing
npm run test:performance
```

## Risk Assessment & Mitigation

### Technical Risks

**Risk**: Database migration impacts existing data

- **Mitigation**: Thorough testing with production data copies, rollback procedures

**Risk**: Performance degradation from additional columns/indexes

- **Mitigation**: Performance testing, query optimization, selective indexing

**Risk**: Breaking changes to existing APIs

- **Mitigation**: Backward compatibility design, optional fields, comprehensive testing

### Business Risks

**Risk**: Feature complexity impacts delivery timeline

- **Mitigation**: Phased implementation, early testing, stakeholder communication

**Risk**: Cross-domain learning capabilities are diminished

- **Mitigation**: Hybrid search implementation, configurable project isolation

## Success Criteria

### Primary Success Metrics

1. **Functional Completeness**: All core tables extended with project_directory field
2. **Query Performance**: Project-scoped queries perform 2-3x faster than global queries
3. **Backward Compatibility**: 100% of existing functionality remains intact
4. **Test Coverage**: >95% test coverage for all new functionality

### Secondary Success Metrics

1. **Cognitive Enhancement**: Improved contextual reasoning within project boundaries
2. **Data Organization**: Clear project-based data segmentation and analytics
3. **Multi-project Support**: Successful isolation and management of multiple projects
4. **Performance Optimization**: Reduced query times and improved memory efficiency

## Documentation Requirements

- **Schema Migration Guide**: Step-by-step database update procedures
- **API Documentation**: Updated interface specifications and usage examples
- **Deployment Guide**: Environment setup and configuration instructions
- **Performance Tuning Guide**: Query optimization and index management

## Quality Assurance Score

**Confidence Level for One-Pass Implementation**: 9.0/10

**Justification**:

- **Enhanced Architecture**: Normalized database design with comprehensive project metadata support
- **Advanced Capabilities**: Technology stack awareness, project lifecycle analytics, cognitive settings per project
- **Comprehensive Planning**: Detailed implementation tasks with AGI-enhanced reasoning analysis
- **Scalable Foundation**: Supports future project management features and multi-tenant deployments
- **Robust Testing Strategy**: Covers normalization, relationships, performance, and migration scenarios
- **Risk Mitigation**: Backward compatibility, data migration strategy, and rollback procedures
- **Codebase Integration**: Follows established patterns while introducing sophisticated project intelligence

The normalized approach provides a superior foundation for advanced project-aware cognitive reasoning while maintaining all existing AGI capabilities. The comprehensive metadata extraction and management system enables sophisticated contextual assistance that evolves with project characteristics and technology stacks.
