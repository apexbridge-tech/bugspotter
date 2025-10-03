import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Directory for saving bug reports
const REPORTS_DIR = path.join(__dirname, 'bug-reports');

// Ensure reports directory exists
try {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
} catch (err) {
  console.error('Failed to create reports directory:', err);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large screenshots
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  if (req.headers.authorization) {
    console.log(`Authorization: ${req.headers.authorization}`);
  }
  next();
});

// Store bug reports in memory (for testing only)
const bugReports = [];
let bugIdCounter = 1;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all bug reports
app.get('/api/bugs', (req, res) => {
  console.log(`Returning ${bugReports.length} bug reports`);
  res.json({
    total: bugReports.length,
    bugs: bugReports,
  });
});

// Get single bug report
app.get('/api/bugs/:id', (req, res) => {
  const bug = bugReports.find((b) => b.id === req.params.id);
  if (!bug) {
    return res.status(404).json({ error: 'Bug report not found' });
  }
  res.json(bug);
});

// Submit bug report
app.post('/api/bugs', async (req, res) => {
  console.log('\n📝 Bug Report Received!');
  console.log('─────────────────────────────────────');

  // Validate API key if present
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (apiKey) {
    console.log(`✓ API Key: ${apiKey}`);
    // In production, validate against database
    if (apiKey !== 'demo-api-key-12345' && apiKey !== 'test-api-key') {
      console.log('✗ Invalid API key');
      return res.status(401).json({ error: 'Invalid API key' });
    }
  }

  const { title, description, report } = req.body;

  // Validate required fields
  if (!title || !description) {
    console.log('✗ Missing required fields');
    return res.status(400).json({ error: 'Title and description are required' });
  }

  if (!report) {
    console.log('✗ Missing report data');
    return res.status(400).json({ error: 'Report data is required' });
  }

  // Create bug report record
  const bugId = `bug-${bugIdCounter++}`;
  const bugReport = {
    id: bugId,
    title,
    description,
    report: {
      screenshot: report.screenshot?.substring(0, 50) + '...', // Truncate for display
      console: report.console,
      network: report.network,
      metadata: report.metadata,
    },
    receivedAt: new Date().toISOString(),
  };

  bugReports.push(bugReport);

  // Save to file
  const filename = `bug-${bugId}-${Date.now()}.json`;
  const filepath = path.join(REPORTS_DIR, filename);
  
  try {
    await fs.writeFile(filepath, JSON.stringify({
      id: bugId,
      title,
      description,
      report,
      receivedAt: bugReport.receivedAt,
    }, null, 2));
    console.log(`💾 Saved to: ${filename}`);
  } catch (err) {
    console.error('Failed to save report to file:', err.message);
  }

  // Log summary
  console.log(`✓ Title: ${title}`);
  console.log(`✓ Description: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`);
  console.log(`✓ Console Logs: ${report.console?.length || 0} entries`);
  console.log(`✓ Network Requests: ${report.network?.length || 0} requests`);
  console.log(`✓ Screenshot: ${report.screenshot ? 'Captured' : 'Not available'}`);
  console.log(`✓ Browser: ${report.metadata?.browser || 'Unknown'}`);
  console.log(`✓ OS: ${report.metadata?.os || 'Unknown'}`);
  console.log(`✓ URL: ${report.metadata?.url || 'Unknown'}`);
  console.log(`✓ Viewport: ${report.metadata?.viewport?.width}x${report.metadata?.viewport?.height}`);
  
  // Log detailed console entries
  if (report.console && report.console.length > 0) {
    console.log('\n📋 Console Logs:');
    report.console.slice(0, 10).forEach((log, index) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const level = log.level.toUpperCase().padEnd(5);
      const message = log.message.substring(0, 80);
      console.log(`  ${index + 1}. [${time}] ${level} ${message}${log.message.length > 80 ? '...' : ''}`);
    });
    if (report.console.length > 10) {
      console.log(`  ... and ${report.console.length - 10} more entries`);
    }
  }
  
  // Log detailed network requests
  if (report.network && report.network.length > 0) {
    console.log('\n🌐 Network Requests:');
    report.network.slice(0, 5).forEach((req, index) => {
      const method = req.method.padEnd(6);
      const status = req.status ? `${req.status}` : 'FAIL';
      const duration = req.duration ? `${req.duration}ms` : 'N/A';
      const url = req.url.length > 60 ? req.url.substring(0, 57) + '...' : req.url;
      console.log(`  ${index + 1}. ${method} ${status.padEnd(4)} ${duration.padEnd(6)} ${url}`);
    });
    if (report.network.length > 5) {
      console.log(`  ... and ${report.network.length - 5} more requests`);
    }
  }
  
  console.log('─────────────────────────────────────');
  console.log(`✓ Bug Report ID: ${bugId}`);
  console.log(`✓ Total Reports: ${bugReports.length}\n`);

  // Simulate processing delay (optional)
  const simulateDelay = req.query.delay ? parseInt(req.query.delay) : 0;
  
  setTimeout(() => {
    res.status(201).json({
      success: true,
      bugId,
      message: 'Bug report received successfully',
      timestamp: new Date().toISOString(),
    });
  }, simulateDelay);
});

// Simulate error responses for testing
app.post('/api/bugs/error/:code', (req, res) => {
  const code = parseInt(req.params.code);
  const errorMessages = {
    400: 'Bad Request - Invalid payload',
    401: 'Unauthorized - Invalid API key',
    403: 'Forbidden - Access denied',
    404: 'Not Found - Endpoint does not exist',
    500: 'Internal Server Error - Something went wrong',
    503: 'Service Unavailable - Server is temporarily unavailable',
  };

  console.log(`\n✗ Simulating ${code} error`);
  res.status(code).json({
    error: errorMessages[code] || 'Unknown error',
    timestamp: new Date().toISOString(),
  });
});

// Delete all bug reports (for testing)
app.delete('/api/bugs', (req, res) => {
  const count = bugReports.length;
  bugReports.length = 0;
  bugIdCounter = 1;
  console.log(`\n🗑️  Deleted ${count} bug reports`);
  res.json({ success: true, deleted: count });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│   BugSpotter Mock API Server Started   │');
  console.log('└─────────────────────────────────────────┘\n');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📝 Submit bugs: POST http://localhost:${PORT}/api/bugs`);
  console.log(`📋 View bugs: GET http://localhost:${PORT}/api/bugs`);
  console.log('\n⏳ Waiting for bug reports...\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});
