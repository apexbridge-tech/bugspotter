/**
 * Example: Using transactions for atomic operations
 *
 * Transactions ensure that multiple database operations either all succeed
 * or all fail together, maintaining data consistency.
 */

import { createDatabaseClient } from '../src/index.js';

async function main() {
  const db = createDatabaseClient();

  try {
    // Example 1: Create bug report with session atomically
    console.log('\n=== Example 1: Bug Report + Session ===');
    const result1 = await db.transaction(async (client) => {
      // Create the bug report
      const bug = await client.createBugReport({
        project_id: 'some-project-uuid',
        title: 'Payment button not working',
        description: 'Users cannot complete checkout',
        priority: 'critical',
        status: 'open',
      });

      console.log(`Created bug report: ${bug.id}`);

      // Create associated session replay
      const session = await client.createSession(bug.id, {
        type: 'rrweb',
        events: [
          { type: 'FullSnapshot', timestamp: Date.now() },
          // ... more events
        ],
      });

      console.log(`Created session: ${session.id}`);

      return { bug, session };
    });

    console.log('Transaction committed successfully!');
    console.log(`Bug: ${result1.bug.id}, Session: ${result1.session.id}`);

    // Example 2: Transaction rollback on error
    console.log('\n=== Example 2: Transaction Rollback ===');
    try {
      await db.transaction(async (client) => {
        // Create first bug report
        const bug1 = await client.createBugReport({
          project_id: 'some-project-uuid',
          title: 'First Bug',
          priority: 'high',
        });

        console.log(`Created bug 1: ${bug1.id}`);

        // This would normally create a second bug
        const bug2 = await client.createBugReport({
          project_id: 'some-project-uuid',
          title: 'Second Bug',
          priority: 'low',
        });

        console.log(`Created bug 2: ${bug2.id}`);

        // Simulate an error - this will rollback both inserts
        throw new Error('Test error - should rollback');
      });
    } catch (error) {
      console.log(
        'Transaction rolled back as expected:',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Example 3: Batch operations with transaction
    console.log('\n=== Example 4: Batch Insert ===');
    const bugs = await db.createBugReports([
      {
        project_id: 'some-project-uuid',
        title: 'Issue 1',
        priority: 'low',
      },
      {
        project_id: 'some-project-uuid',
        title: 'Issue 2',
        priority: 'medium',
      },
      {
        project_id: 'some-project-uuid',
        title: 'Issue 3',
        priority: 'high',
      },
    ]);

    console.log(`Created ${bugs.length} bug reports in batch`);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
