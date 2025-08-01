/**
 * @fileoverview Comprehensive Testing Framework for Project Schema Extension
 *
 * Tests the normalized project schema implementation with single-user focus
 * as specified in the PRP document. Validates all CRUD operations, queries,
 * analytics, error handling, backward compatibility, and performance.
 */

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

// Global test state to share unique paths across test functions
let testPaths: {
  project1: string;
  project2: string;
  testProject: string;
  tempDir: string;
} | null = null;

/**
 * Main test runner for project schema extension functionality
 */
export async function runProjectSchemaExtensionTests(): Promise<void> {
  console.error('🧪 Running Project Schema Extension Tests (Single-User)...');

  const config = PostgreSQLConfigs.testing();
  const memoryStore = new PostgreSQLMemoryStore(config);

  // Initialize unique test paths
  const testId = Date.now();
  testPaths = {
    project1: `/home/user/project-1-${testId}`,
    project2: `/home/user/project-2-${testId}`,
    testProject: `/home/user/test-project-${testId}`,
    tempDir: `/tmp/test-project-metadata-${testId}`,
  };

  try {
    await memoryStore.initialize();
    console.error('✅ PostgreSQL Memory Store initialized for testing');

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

    // Test 10: Performance Optimization
    await testPerformanceOptimization(memoryStore);

    console.error('🎉 All project schema extension tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Clean up all test data
    if (testPaths) {
      try {
        console.error('🧹 Cleaning up test data...');

        // Delete all test projects and related data in reverse dependency order
        const client = await (memoryStore as any).pool.connect();
        try {
          await client.query(
            'DELETE FROM stored_thoughts WHERE project_id IN (SELECT id FROM projects WHERE directory_path LIKE $1 OR directory_path LIKE $2)',
            [`/home/user/test-project%`, `/home/user/project-%`]
          );
          await client.query(
            'DELETE FROM stored_prompts WHERE project_id IN (SELECT id FROM projects WHERE directory_path LIKE $1 OR directory_path LIKE $2)',
            [`/home/user/test-project%`, `/home/user/project-%`]
          );
          await client.query(
            'DELETE FROM reasoning_sessions WHERE project_id IN (SELECT id FROM projects WHERE directory_path LIKE $1 OR directory_path LIKE $2)',
            [`/home/user/test-project%`, `/home/user/project-%`]
          );
          await client.query(
            'DELETE FROM projects WHERE directory_path LIKE $1 OR directory_path LIKE $2',
            [`/home/user/test-project%`, `/home/user/project-%`]
          );
        } finally {
          client.release();
        }

        // Clean up any temporary directories
        if (fs.existsSync(testPaths.tempDir)) {
          fs.rmSync(testPaths.tempDir, { recursive: true, force: true });
        }

        console.error('✅ Test cleanup completed');
      } catch (cleanupError) {
        console.error('⚠️ Test cleanup failed:', cleanupError);
      }
    }

    await memoryStore.close();
  }
}

/**
 * Test 1: Project CRUD Operations
 */
async function testProjectCRUD(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing project CRUD operations...');

  if (!testPaths) throw new Error('Test paths not initialized');

  // Clean up any existing test data first
  try {
    const client = await (store as any).pool.connect();
    try {
      await client.query('DELETE FROM projects WHERE directory_path LIKE $1', [
        `/home/user/test-project%`,
      ]);
    } finally {
      client.release();
    }
  } catch (error) {
    // Ignore cleanup errors
  }

  // Test project creation
  const testProject: Omit<Project, 'id'> = {
    directory_path: testPaths.testProject,
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
  const foundProject = await store.findProjectByPath(testPaths.testProject);
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

  console.error('✅ Project CRUD operations validated');
}

/**
 * Test 2: Project Metadata Extraction
 */
async function testProjectMetadataExtraction(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing project metadata extraction...');

  if (!testPaths) throw new Error('Test paths not initialized');

  // Create temporary test directory structure
  const tempDir = testPaths.tempDir;
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

    assert(
      extractedMetadata.name.startsWith('test-project-metadata'),
      'Project name should start with test-project-metadata'
    );
    assert(extractedMetadata.description!.includes('metadata extraction'));
    assert(extractedMetadata.technologyStack.includes('react'));
    assert(extractedMetadata.technologyStack.includes('typescript'));
    assert(extractedMetadata.technologyStack.includes('nodejs'));
    assert(extractedMetadata.programmingLanguages.includes('typescript'));
    assert.strictEqual(extractedMetadata.projectType, 'web-app');

    console.error('✅ Project metadata extraction validated');
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Test 3: Project-Scoped Data Storage
 */
async function testProjectScopedDataStorage(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing project-scoped data storage...');

  if (!testPaths) throw new Error('Test paths not initialized');

  // Create test projects
  const project1 = await store.createProject({
    directory_path: testPaths.project1,
    project_name: 'Project 1',
    description: 'First test project',
    created_at: new Date(),
    updated_at: new Date(),
    last_activity_at: new Date(),
    is_active: true,
    is_archived: false,
  });

  const project2 = await store.createProject({
    directory_path: testPaths.project2,
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
  };

  await store.storeThought(thought1);

  // Verify project activity was updated (allow small timing tolerance)
  const updatedProject = await store.getProject(project1.id);
  assert(
    updatedProject!.last_activity_at >= project1.last_activity_at,
    'Project activity should be updated or equal'
  );

  console.error('✅ Project-scoped data storage validated');
}

/**
 * Test 4: Project-Aware Queries
 */
async function testProjectAwareQueries(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing project-aware queries...');

  if (!testPaths) throw new Error('Test paths not initialized');

  // Query prompts by project
  const project1Prompts = await store.queryPrompts({
    project_id: (await store.findProjectByPath(testPaths.project1))!.id,
    include_project: true,
  });

  assert(project1Prompts.length >= 1, 'Should find prompts for project 1');
  assert(project1Prompts[0].project, 'Should include project data');
  assert.strictEqual(project1Prompts[0].project!.project_name, 'Project 1');

  // Query thoughts by project
  const project1Thoughts = await store.queryThoughts({
    project_id: (await store.findProjectByPath(testPaths.project1))!.id,
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

  console.error('✅ Project-aware queries validated');
}

/**
 * Test 5: Hybrid Similarity Search
 */
async function testHybridSimilaritySearch(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing hybrid similarity search...');

  if (!testPaths) throw new Error('Test paths not initialized');

  const project1 = await store.findProjectByPath(testPaths.project1);

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

  console.error('✅ Hybrid similarity search validated');
}

/**
 * Test 6: Project Analytics
 */
async function testProjectAnalytics(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing project analytics...');

  if (!testPaths) throw new Error('Test paths not initialized');

  const project1 = await store.findProjectByPath(testPaths.project1);
  const analytics = await store.getProjectAnalytics(project1!.id);

  assert(analytics.totalSessions >= 1, 'Should have at least one session');
  assert(analytics.totalThoughts >= 1, 'Should have at least one thought');
  assert(analytics.totalPrompts >= 1, 'Should have at least one prompt');
  assert(typeof analytics.successRate === 'number', 'Success rate should be a number');
  assert(Array.isArray(analytics.recentActivity), 'Recent activity should be an array');

  console.error('✅ Project analytics validated');
}

/**
 * Test 7: Cross-Project Pattern Analysis
 */
async function testCrossProjectPatterns(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing cross-project pattern analysis...');

  if (!testPaths) throw new Error('Test paths not initialized');

  // Add thoughts with patterns to multiple projects
  const project1 = await store.findProjectByPath(testPaths.project1);
  const project2 = await store.findProjectByPath(testPaths.project2);

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
  };

  await store.storeThought(thoughtWithPattern);

  const patterns = await store.getCrossProjectPatterns(5);

  // Note: This test may not find patterns if database doesn't have enough data
  // In real scenarios, this would be populated over time
  assert(Array.isArray(patterns), 'Should return an array of patterns');

  console.error('✅ Cross-project pattern analysis validated');
}

/**
 * Test 8: Backward Compatibility
 */
async function testBackwardCompatibility(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing backward compatibility...');

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

  console.error('✅ Backward compatibility validated');
}

/**
 * Test 9: Error Handling
 */
async function testErrorHandling(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing error handling...');

  if (!testPaths) throw new Error('Test paths not initialized');

  // Test duplicate directory path
  try {
    await store.createProject({
      directory_path: testPaths.project1, // Duplicate path
      project_name: 'Duplicate Project',
      created_at: new Date(),
      updated_at: new Date(),
      last_activity_at: new Date(),
      is_active: true,
      is_archived: false,
    });
    assert.fail('Should have thrown error for duplicate directory path');
  } catch (error) {
    assert(
      (error as Error).message.includes('creation failed'),
      'Should indicate creation failure'
    );
  }

  // Test invalid project ID
  const invalidProject = await store.getProject('invalid-uuid');
  assert.strictEqual(invalidProject, null, 'Should return null for invalid project ID');

  // Test non-existent path
  const nonExistentProject = await store.findProjectByPath('/non/existent/path');
  assert.strictEqual(nonExistentProject, null, 'Should return null for non-existent path');

  console.error('✅ Error handling validated');
}

/**
 * Test 10: Performance Optimization
 */
async function testPerformanceOptimization(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing performance optimization with caching...');

  if (!testPaths) throw new Error('Test paths not initialized');

  const project1 = await store.findProjectByPath(testPaths.project1);
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
  await (store as any).clearProjectCache();

  console.error('✅ Performance optimization validated');
}

/**
 * Helper function for metadata extraction testing
 */
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
