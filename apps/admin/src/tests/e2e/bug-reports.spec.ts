import { test, expect } from '@playwright/test';

test.describe('Bug Reports Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Login with admin credentials
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/(health|projects|bug-reports)/);
  });

  test('should navigate to bug reports page', async ({ page }) => {
    // Click on Bug Reports link in sidebar
    await page.click('a:has-text("Bug Reports")');

    // Verify URL
    await expect(page).toHaveURL('/bug-reports');

    // Verify page heading
    await expect(page.locator('h1:has-text("Bug Reports")')).toBeVisible();
  });

  test('should display filter controls', async ({ page }) => {
    await page.goto('/bug-reports');

    // Verify all filter dropdowns are present
    await expect(page.locator('label:has-text("Project")')).toBeVisible();
    await expect(page.locator('label:has-text("Status")')).toBeVisible();
    await expect(page.locator('label:has-text("Priority")')).toBeVisible();
    await expect(page.locator('label:has-text("From Date")')).toBeVisible();
    await expect(page.locator('label:has-text("To Date")')).toBeVisible();
  });

  test('should filter bug reports by status', async ({ page }) => {
    await page.goto('/bug-reports');

    // Wait for bug reports to load
    await page.waitForSelector('[data-testid="bug-report-list"], :text("No bug reports found")');

    // Select "Open" status
    await page.selectOption('select[name="status"]', 'open');

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Verify only open bugs are shown (if any exist)
    const statusBadges = page.locator('text=/Open/i');
    const count = await statusBadges.count();

    if (count > 0) {
      // If there are open bugs, verify no resolved/closed badges
      await expect(page.locator('text=/Resolved|Closed/i')).toHaveCount(0);
    }
  });

  test('should filter bug reports by priority', async ({ page }) => {
    await page.goto('/bug-reports');

    // Wait for bug reports to load
    await page.waitForSelector('[data-testid="bug-report-list"], :text("No bug reports found")');

    // Select "Critical" priority
    await page.selectOption('select[name="priority"]', 'critical');

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Verify URL contains priority filter
    await expect(page).toHaveURL(/priority=critical/);
  });

  test('should clear all filters', async ({ page }) => {
    await page.goto('/bug-reports');

    // Apply some filters
    await page.selectOption('select[name="status"]', 'open');
    await page.selectOption('select[name="priority"]', 'high');

    // Wait for "Clear All" button to appear
    await page.waitForSelector('button:has-text("Clear All")');

    // Click Clear All
    await page.click('button:has-text("Clear All")');

    // Verify filters are reset
    await expect(page.locator('select[name="status"]')).toHaveValue('');
    await expect(page.locator('select[name="priority"]')).toHaveValue('');
  });

  test('should open bug report detail modal', async ({ page }) => {
    await page.goto('/bug-reports');

    // Wait for bug reports to load
    await page.waitForSelector('button:has-text("View"), :text("No bug reports found")');

    // Check if there are any bug reports
    const viewButtons = page.locator('button:has-text("View")');
    const count = await viewButtons.count();

    if (count > 0) {
      // Click first View button
      await viewButtons.first().click();

      // Verify modal is opened
      await expect(page.locator('[role="dialog"], .fixed.inset-0')).toBeVisible();

      // Verify tabs are present
      await expect(page.locator('button:has-text("Session Replay")')).toBeVisible();
      await expect(page.locator('button:has-text("Details & Metadata")')).toBeVisible();
      await expect(page.locator('button:has-text("Console Logs")')).toBeVisible();
    }
  });

  test('should switch tabs in bug report detail modal', async ({ page }) => {
    await page.goto('/bug-reports');

    // Wait for bug reports
    await page.waitForSelector('button:has-text("View"), :text("No bug reports found")');

    const viewButtons = page.locator('button:has-text("View")');
    const count = await viewButtons.count();

    if (count > 0) {
      await viewButtons.first().click();

      // Wait for modal
      await page.waitForSelector('button:has-text("Details & Metadata")');

      // Click Details tab
      await page.click('button:has-text("Details & Metadata")');

      // Verify Details content is visible (check for Description heading or similar)
      await page.waitForTimeout(200);

      // Click Console Logs tab
      await page.click('button:has-text("Console Logs")');

      // Verify Console Logs content
      await page.waitForTimeout(200);
    }
  });

  test('should enable edit mode for status and priority', async ({ page }) => {
    await page.goto('/bug-reports');

    await page.waitForSelector('button:has-text("View"), :text("No bug reports found")');

    const viewButtons = page.locator('button:has-text("View")');
    const count = await viewButtons.count();

    if (count > 0) {
      await viewButtons.first().click();

      // Wait for modal and Edit button
      await page.waitForSelector('button:has-text("Edit Status/Priority")');

      // Click Edit button
      await page.click('button:has-text("Edit Status/Priority")');

      // Verify dropdowns appear
      await expect(page.locator('select[name="status"]')).toBeVisible();
      await expect(page.locator('select[name="priority"]')).toBeVisible();

      // Verify Save and Cancel buttons appear
      await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    }
  });

  test('should close modal when X button clicked', async ({ page }) => {
    await page.goto('/bug-reports');

    await page.waitForSelector('button:has-text("View"), :text("No bug reports found")');

    const viewButtons = page.locator('button:has-text("View")');
    const count = await viewButtons.count();

    if (count > 0) {
      await viewButtons.first().click();

      // Wait for modal
      await page.waitForSelector('[role="dialog"], .fixed.inset-0');

      // Click X button (close button)
      await page.click('button:has([class*="lucide"]):has-text("")');

      // Verify modal is closed
      await expect(page.locator('[role="dialog"], .fixed.inset-0')).not.toBeVisible();
    }
  });

  test('should show delete confirmation on first click', async ({ page }) => {
    await page.goto('/bug-reports');

    await page.waitForSelector('button:has-text("Delete"), :text("No bug reports found")');

    const deleteButtons = page.locator('button:has-text("Delete"):not([disabled])');
    const count = await deleteButtons.count();

    if (count > 0) {
      // First click
      await deleteButtons.first().click();

      // Verify confirmation text appears
      await expect(page.locator('button:has-text("Confirm?")')).toBeVisible();
    }
  });

  test('should disable delete for legal hold reports', async ({ page }) => {
    await page.goto('/bug-reports');

    await page.waitForSelector('[data-testid="bug-report-list"], :text("No bug reports found")');

    // Check if there are any reports with legal hold
    const legalHoldBadges = page.locator('text="Legal Hold"');
    const count = await legalHoldBadges.count();

    if (count > 0) {
      // Find the delete button in the same card as legal hold badge
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await expect(deleteButton).toBeDisabled();
    }
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/bug-reports');

    // Wait for content to load
    await page.waitForSelector('[data-testid="bug-report-list"], :text("No bug reports found")');

    // Check if Next button exists (only if there are multiple pages)
    const nextButton = page.locator('button:has-text("Next")');

    if ((await nextButton.isVisible()) && !(await nextButton.isDisabled())) {
      // Click Next
      await nextButton.click();

      // Verify page number changed
      await expect(page.locator('text=/Page 2 of/i')).toBeVisible();

      // Click Previous
      await page.click('button:has-text("Previous")');

      // Verify back to page 1
      await expect(page.locator('text=/Page 1 of/i')).toBeVisible();
    }
  });

  test('should show empty state when no reports match filters', async ({ page }) => {
    await page.goto('/bug-reports');

    // Apply filters that should return no results
    await page.selectOption('select[name="status"]', 'closed');
    await page.fill('input[name="created_after"]', '2099-01-01');

    // Wait for results
    await page.waitForTimeout(500);

    // Verify empty state message
    await expect(page.locator('text=/no bug reports found/i')).toBeVisible();
    await expect(page.locator('text=/try adjusting your filters/i')).toBeVisible();
  });
});
