/**
 * Example usage of the BugSpotter backend
 * This file demonstrates how to use the database client
 */

import {
  createDatabaseClient,
  validateConfig,
  type BugReport,
  type Project,
} from '../src/index.js';

async function example() {
  console.log('BugSpotter Backend Example\n');

  // Validate configuration
  try {
    validateConfig();
    console.log('✓ Configuration validated\n');
  } catch (error) {
    console.error('✗ Configuration error:', error);
    console.log('\nPlease set DATABASE_URL in your .env file');
    process.exit(1);
  }

  // Create database client
  const db = createDatabaseClient();

  try {
    // Test connection
    console.log('Testing database connection...');
    const isConnected = await db.testConnection();

    if (!isConnected) {
      console.error('✗ Failed to connect to database');
      process.exit(1);
    }
    console.log('✓ Database connected\n');

    // Example: Create a project
    console.log('Creating a project...');
    const project: Project = await db.createProject({
      name: 'Example Project',
      api_key: `bs_test_${Date.now()}`,
      settings: {
        allowedOrigins: ['http://localhost:3000'],
        notificationEmail: 'bugs@example.com',
      },
    });
    console.log(`✓ Created project: ${project.name} (${project.id})\n`);

    // Example: Create a bug report
    console.log('Creating a bug report...');
    const bugReport: BugReport = await db.createBugReport({
      project_id: project.id,
      title: 'Example bug: Button not clickable',
      description: 'The submit button on the form does not respond to clicks',
      priority: 'high',
      status: 'open',
      metadata: {
        browser: 'Chrome 120.0.0',
        os: 'macOS 14.0',
        url: 'http://localhost:3000/form',
        userAgent: 'Mozilla/5.0...',
      },
    });
    console.log(`✓ Created bug report: ${bugReport.title} (${bugReport.id})\n`);

    // Example: List bug reports
    console.log('Listing bug reports...');
    const result = await db.listBugReports(
      { project_id: project.id },
      { sort_by: 'created_at', order: 'desc' },
      { page: 1, limit: 10 }
    );
    console.log(`✓ Found ${result.pagination.total} bug report(s):`);
    result.data.forEach((bug) => {
      console.log(`  - ${bug.title} [${bug.status}] (${bug.priority})`);
    });
    console.log();

    // Example: Update bug report
    console.log('Updating bug report status...');
    const updated = await db.updateBugReport(bugReport.id, {
      status: 'in-progress',
    });
    console.log(`✓ Updated status to: ${updated?.status}\n`);

    // Example: Get bug report
    console.log('Fetching bug report...');
    const fetched = await db.getBugReport(bugReport.id);
    console.log(`✓ Retrieved: ${fetched?.title}\n`);

    // Example: Get project by API key
    console.log('Looking up project by API key...');
    const foundProject = await db.getProjectByApiKey(project.api_key);
    console.log(`✓ Found project: ${foundProject?.name}\n`);

    // Cleanup
    console.log('Cleaning up...');
    await db.deleteBugReport(bugReport.id);
    await db.deleteProject(project.id);
    console.log('✓ Cleanup complete\n');

    console.log('✓ Example completed successfully!');
  } catch (error) {
    console.error('✗ Error:', error);
    process.exit(1);
  } finally {
    // Close database connections
    await db.close();
  }
}

// Run example
example().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
