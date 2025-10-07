// Tab switching functionality (defined early so onclick handlers can use it)
function switchTab(tabName) {
  // Remove active class from all tabs and content
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
  document
    .querySelectorAll('.tab-content')
    .forEach((content) => content.classList.remove('active'));

  // Add active class to selected tab and content
  event.target.closest('.tab').classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  // Save active tab to localStorage
  localStorage.setItem('activeTab', tabName);

  console.log(`📑 Switched to ${tabName} tab`);
}

// Initialize BugSpotter SDK with API Key authentication (simpler for demo)
const bugSpotter = BugSpotter.init({
  endpoint: 'http://localhost:4000/api/bugs',
  apiKey: 'demo-api-key-12345',
  showWidget: false, // Disable auto-widget, we'll create our own
  replay: {
    enabled: true,
    duration: 30, // Keep last 30 seconds
    sampling: {
      mousemove: 50,
      scroll: 100,
    },
  },
});

console.log('✅ BugSpotter SDK initialized with API Key authentication');

// Debug: Check if replay is enabled and recording
if (bugSpotter.domCollector) {
  console.log('✅ DOM Collector is initialized');
  console.log('🎥 Recording status:', bugSpotter.domCollector.isCurrentlyRecording());
  console.log('📊 Buffer size:', bugSpotter.domCollector.getBufferSize());
  console.log('⏱️ Buffer duration:', bugSpotter.domCollector.getDuration(), 'seconds');

  // Check replay events periodically
  setInterval(() => {
    const events = bugSpotter.domCollector.getEvents();
    if (events.length > 0) {
      console.log(`🎬 Replay buffer has ${events.length} events`);
    }
  }, 5000);
} else {
  console.error('❌ DOM Collector is NOT initialized - replay is disabled!');
}

// Global replay player instance
let replayPlayer = null;

// Helper: Submit bug report to API
async function submitBugReport(title, description, report) {
  const payload = {
    title: title,
    description: description,
    report: report,
  };

  console.log('📤 Payload being sent to API:', {
    title: payload.title,
    description: payload.description,
    report: {
      screenshot: payload.report.screenshot ? 'Present' : 'Missing',
      console: payload.report.console?.length || 0,
      network: payload.report.network?.length || 0,
      replay: payload.report.replay?.length || 0,
      metadata: payload.report.metadata ? 'Present' : 'Missing',
    },
  });

  const response = await fetch(bugSpotter.getConfig().endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bugSpotter.getConfig().apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('✅ Bug report submitted successfully:', result);

  // Display success message
  document.getElementById('output').textContent =
    '✅ Bug Report Submitted Successfully!\n' +
    JSON.stringify(
      {
        bugId: result.bugId,
        title: title,
        description: description,
        timestamp: result.timestamp,
        consoleLogs: report.console?.length,
        networkRequests: report.network?.length,
        replayEvents: report.replay?.length,
      },
      null,
      2
    );

  return result;
}

// Helper: Create and show rrweb player
function createReplayPlayer(events, bugId = null) {
  // Show player container
  const container = document.getElementById('replay-player-container');
  container.classList.add('active');

  // Update stats
  const timeSpan = ((events[events.length - 1].timestamp - events[0].timestamp) / 1000).toFixed(2);
  const statsText = bugId
    ? `Bug #${bugId} • ${events.length} events • ${timeSpan}s duration`
    : `${events.length} events • ${timeSpan}s duration`;
  document.getElementById('player-stats').textContent = statsText;

  // Destroy existing player if any
  if (replayPlayer) {
    replayPlayer.pause();
    document.getElementById('replay-player').innerHTML = '';
  }

  // Create new player
  replayPlayer = new rrwebPlayer({
    target: document.getElementById('replay-player'),
    props: {
      events: events,
      autoPlay: true,
      speedOption: [1, 2, 4, 8],
      showController: true,
      skipInactive: false,
      mouseTail: {
        duration: 500,
        strokeStyle: bugId ? '#dc2626' : '#3182ce',
      },
    },
  });

  console.log('🎬 Replay player started with', events.length, 'events');
}

// Helper: Show formatted output in a div
function showOutput(divId, title, content, style = 'info') {
  const outputDiv = document.getElementById(divId);
  outputDiv.style.display = 'block';
  outputDiv.innerHTML = `<strong>${title}</strong><br><br>${content}`;
}

// Helper: Reinitialize SDK with auth config
function reinitializeSDK(authConfig) {
  bugSpotter.destroy();

  const config = {
    endpoint: 'http://localhost:4000/api/bugs',
    showWidget: false,
    replay: { enabled: true, duration: 30 },
    ...authConfig,
  };

  window.bugSpotterInstance = BugSpotter.init(config);
}

// Modal demo handler
async function showBugReportModalDemo() {
  try {
    // Capture real data instead of using placeholder
    const report = await bugSpotter.capture();

    const modal = new BugSpotter.BugReportModal({
      onSubmit: async (data) => {
        console.log('🚀 Submitting bug report to API (from modal demo)...');
        await submitBugReport(data.title, data.description, report);
      },
    });

    modal.show(report.screenshot);
  } catch (error) {
    console.error('Failed to show modal:', error);
  }
}

// Initialize Floating Button Widget (bugSpotter already initialized at top)
const floatingButton = new BugSpotter.FloatingButton({
  position: 'bottom-right',
  icon: '⚡',
  backgroundColor: '#1a365d',
  size: 48,
  offset: { x: 24, y: 24 },
  style: {
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.2s ease',
  },
});

// Add click handler to floating button
floatingButton.onClick(async () => {
  console.log('Floating button clicked - capturing data...');

  try {
    // Capture all the data
    const report = await bugSpotter.capture();

    console.log('📦 Captured report data:', {
      screenshot: report.screenshot
        ? 'Present (' + report.screenshot.length + ' chars)'
        : 'Missing',
      console: report.console.length + ' entries',
      network: report.network.length + ' requests',
      replay: report.replay.length + ' events',
      metadata: report.metadata ? 'Present' : 'Missing',
    });

    // Show the modal with the captured screenshot
    const modal = new BugSpotter.BugReportModal({
      onSubmit: async (data) => {
        console.log('🚀 Submitting bug report to API...');
        console.log('📊 Report being submitted:', {
          title: data.title,
          description: data.description,
          replay_events: report.replay.length,
          console_logs: report.console.length,
          network_requests: report.network.length,
        });
        await submitBugReport(data.title, data.description, report);
      },
    });

    modal.show(report.screenshot);
  } catch (error) {
    console.error('Failed to capture bug report:', error);
  }
});

console.log('✅ Floating button widget initialized');

// Make an initial API call on page load
fetch('https://jsonplaceholder.typicode.com/posts/1')
  .then((res) => res.json())
  .then((data) => console.log('📡 Initial API call successful:', data.title))
  .catch((err) => console.error('❌ Initial API call failed:', err));

// Console Logging Tests
function testConsoleLog() {
  console.log('🔵 This is a LOG message with data:', {
    timestamp: Date.now(),
    user: 'demo-user',
    action: 'button-click',
  });
}

function testConsoleWarn() {
  console.warn('⚠️ This is a WARNING message:', 'Something might be wrong!');
}

function testConsoleError() {
  console.error('🔴 This is an ERROR message:', new Error('Something went wrong!'));
}

function testConsoleInfo() {
  console.info('ℹ️ This is an INFO message:', 'Informational data', [1, 2, 3]);
}

// Network Request Tests
function testSuccessfulRequest() {
  console.log('🌐 Making successful API request...');
  fetch('https://jsonplaceholder.typicode.com/posts/1')
    .then((res) => res.json())
    .then((data) => console.log('✅ Successful request:', data.title))
    .catch((err) => console.error('❌ Request failed:', err));
}

function testFailedRequest() {
  console.log('🌐 Making failed API request...');
  fetch('https://jsonplaceholder.typicode.com/invalid-endpoint-404')
    .then((res) => {
      if (!res.ok) {
        console.error('❌ Request failed with status:', res.status);
      }
      return res.json();
    })
    .catch((err) => console.error('❌ Network error:', err));
}

function testMultipleRequests() {
  console.log('🌐 Making multiple API requests...');
  const requests = [1, 2, 3].map((id) =>
    fetch(`https://jsonplaceholder.typicode.com/posts/${id}`)
      .then((res) => res.json())
      .then((data) => console.log(`✅ Request ${id} complete:`, data.title))
  );

  Promise.all(requests)
    .then(() => console.log('✅ All requests completed'))
    .catch((err) => console.error('❌ Some requests failed:', err));
}

function testXHRRequest() {
  console.log('🌐 Making XMLHttpRequest...');
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://jsonplaceholder.typicode.com/posts/5');
  xhr.onload = function () {
    if (xhr.status === 200) {
      console.log('✅ XHR request successful');
    }
  };
  xhr.onerror = function () {
    console.error('❌ XHR request failed');
  };
  xhr.send();
}

// PII and Credentials Sanitization Tests
function testPIISanitization() {
  console.log('🔒 Testing PII and credential detection/sanitization...');

  const testData = {
    // PII (Personally Identifiable Information)
    email: 'john.doe@example.com',
    phone: '(555) 123-4567',
    creditCard: '4532-1234-5678-9010',
    ssn: '123-45-6789',
    ipAddress: '192.168.1.100',

    // Credentials (Secrets - NOT PII, but still sensitive)
    apiKey: 'sk_live_abc123def456ghi789',
    token: 'ghp_1234567890abcdefghijklmnopqrstuv',
    password: 'MySecureP@ss123',

    // Normal data
    normalData: 'This is normal data without PII or secrets',
  };

  // Use the SDK's sanitization utility
  const sanitized = BugSpotter.sanitize(JSON.stringify(testData, null, 2));

  document.getElementById('pii-output').style.display = 'block';
  document.getElementById('pii-output').innerHTML = `
    <strong>✅ Data Sanitization Test Complete</strong><br><br>
    <strong>Original Data (PII + Credentials):</strong><br>
    <pre style="background: #fff5f5; padding: 0.5rem; border-radius: 4px; overflow-x: auto;">${JSON.stringify(testData, null, 2)}</pre>
    <br>
    <strong>Sanitized Data (Protected):</strong><br>
    <pre style="background: #f0fff4; padding: 0.5rem; border-radius: 4px; overflow-x: auto;">${sanitized}</pre>
    <br>
    <em style="color: #38a169;">✓ PII: email, phone, credit card, SSN, IP</em><br>
    <em style="color: #3182ce;">✓ Credentials: API keys, tokens, passwords</em>
  `;

  console.log('Original data:', testData);
  console.log('Sanitized data:', sanitized);
}

function testPIIInConsole() {
  console.log('=== Testing PII Detection ===');
  console.log('📧 User email: support@example.com');
  console.log('📞 Contact phone: +1 (555) 987-6543');
  console.log('💳 Payment method: 5555-5555-5555-4444');
  console.log('🆔 SSN: 987-65-4321');
  console.log('');
  console.log('=== Testing Credential Detection ===');
  console.log('🔑 API Key: sk_test_FAKE_KEY_FOR_DEMO_ONLY');
  console.log('🎫 GitHub Token: ghp_FAKE_TOKEN_FOR_DEMO');
  console.log('🔐 Password: MyP@ssw0rd123!');
  console.warn('⚠️ All sensitive data is automatically sanitized when captured!');
  console.info('ℹ️ Check the Console Data section below to see sanitized logs');
}

function showSanitizedData() {
  const sampleText = `
User Profile & Access Information:
========================================
PERSONAL INFORMATION (PII):
- Email: alice.smith@company.com
- Phone: 555-123-4567
- Mobile: +1-555-987-6543
- Credit Card: 4111111111111111
- SSN: 456-78-9012
- IP Address: 10.0.1.45

CREDENTIALS (SECRETS - NOT PII):
- API Key: sk_live_FAKE_DEMO_KEY_NOT_REAL
- Access Token: ghp_FAKE_DEMO_TOKEN_NOT_REAL
- Password: MySecure123!Pass

SAFE DATA:
- Customer ID: #12345
- Order Number: ORD-2024-5678
  `.trim();

  const sanitized = BugSpotter.sanitize(sampleText);

  document.getElementById('pii-output').style.display = 'block';
  document.getElementById('pii-output').innerHTML = `
    <strong>✅ Text Sanitization Demo</strong><br><br>
    <strong>Before Sanitization:</strong><br>
    <div style="background: #fff5f5; padding: 0.5rem; border-radius: 4px; white-space: pre-wrap; margin-bottom: 1rem;">${sampleText}</div>
    <strong>After Sanitization:</strong><br>
    <div style="background: #f0fff4; padding: 0.5rem; border-radius: 4px; white-space: pre-wrap;">${sanitized}</div>
    <br>
    <em style="color: #38a169;">✓ PII redacted: email, phone, credit card, SSN, IP address</em><br>
    <em style="color: #3182ce;">✓ Credentials redacted: API keys, tokens, passwords</em><br>
    <em style="color: #718096;">✓ Safe data preserved: customer ID, order number</em>
  `;

  console.log('Sanitization complete - check output above');
}

// Metadata Display
function showCurrentMetadata() {
  const metadata = {
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    url: window.location.href,
    timestamp: new Date().toISOString(),
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio,
    },
  };

  console.log('📊 Current Browser Metadata:', metadata);
  alert('Check the console for current metadata!');
}

// Floating Button Widget Controls
function showFloatingButton() {
  floatingButton.show();
  console.log('👁️ Floating button shown');
}

function hideFloatingButton() {
  floatingButton.hide();
  console.log('🙈 Floating button hidden');
}

function changeButtonIcon() {
  const icons = ['⚡', '◆', '●', '■', '▲', '◈'];
  const randomIcon = icons[Math.floor(Math.random() * icons.length)];
  floatingButton.setIcon(randomIcon);
  console.log(`Icon changed to: ${randomIcon}`);
}

function changeButtonColor() {
  const colors = ['#1a365d', '#2c5282', '#2b6cb0', '#2a4365', '#1e3a8a', '#1e40af'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  floatingButton.setBackgroundColor(randomColor);
  console.log(`Color updated to: ${randomColor}`);
}

// Main Capture Function
async function captureBugReport() {
  const btn = event?.target;
  const originalText = btn?.textContent;

  if (btn) {
    btn.textContent = '⏳ Capturing...';
    btn.classList.add('loading');
    btn.disabled = true;
  }

  console.log('🐛 Starting bug report capture...');

  try {
    // Add a small delay to ensure all console logs are captured
    await new Promise((resolve) => setTimeout(resolve, 100));

    const data = await bugSpotter.capture();

    console.log('✅ Bug report captured successfully!');

    // Format the output nicely
    const formattedData = {
      '🕐 Captured At': new Date(data.metadata.timestamp).toLocaleString(),
      '🌍 URL': data.metadata.url,
      '🖥️ Browser': data.metadata.browser,
      '💻 OS': data.metadata.os,
      '📐 Viewport': `${data.metadata.viewport.width}x${data.metadata.viewport.height}`,
      '📝 Console Logs': `${data.console.length} entries`,
      '🌐 Network Requests': `${data.network.length} requests`,
      '🎥 Replay Events': `${data.replay.length} events (${data.replay.length > 0 ? ((data.replay[data.replay.length - 1].timestamp - data.replay[0].timestamp) / 1000).toFixed(1) + 's' : '0s'})`,
      '📸 Screenshot': data.screenshot === 'SCREENSHOT_FAILED' ? '❌ Failed' : '✅ Captured',
      '📦 Full Data': data,
    };

    document.getElementById('output').textContent = JSON.stringify(formattedData, null, 2);
  } catch (error) {
    console.error('❌ Failed to capture bug report:', error);
    document.getElementById('output').textContent =
      '❌ Error capturing bug report:\n' + error.message;
  } finally {
    if (btn) {
      btn.textContent = originalText;
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }
}

// Session Replay Functions
function playReplay() {
  const events = bugSpotter.domCollector.getEvents();

  if (events.length === 0) {
    alert('No replay events captured yet. Interact with the page first!');
    return;
  }

  // Check if we have a fullSnapshot event (type 2)
  const hasSnapshot = events.some((e) => e.type === 2);
  if (!hasSnapshot) {
    console.warn('⚠️ No full snapshot found in events. Replay may not display correctly.');
  }

  try {
    createReplayPlayer(events);
    console.log('Event types:', [...new Set(events.map((e) => e.type))]);
  } catch (error) {
    console.error('Failed to create replay player:', error);
    alert('Failed to start replay player: ' + error.message);
  }
}

function stopReplay() {
  const container = document.getElementById('replay-player-container');
  container.classList.remove('active');

  if (replayPlayer) {
    replayPlayer.pause();
  }

  console.log('⏹️ Replay player stopped');
}

async function showReplayInfo() {
  try {
    const report = await bugSpotter.capture();
    const replayEvents = report.replay;

    const infoDiv = document.getElementById('replay-info');
    infoDiv.style.display = 'block';

    if (replayEvents.length === 0) {
      infoDiv.innerHTML =
        '<strong>No replay events captured yet.</strong><br>Interact with the page to generate events!';
      return;
    }

    const timeSpan = (
      (replayEvents[replayEvents.length - 1].timestamp - replayEvents[0].timestamp) /
      1000
    ).toFixed(2);
    const eventTypes = [...new Set(replayEvents.map((e) => e.type))];

    infoDiv.innerHTML = `
      <strong>📊 Replay Buffer Status:</strong><br>
      • Total Events: ${replayEvents.length}<br>
      • Time Span: ${timeSpan} seconds<br>
      • Event Types: ${eventTypes.join(', ')}<br>
      • First Event: ${new Date(replayEvents[0].timestamp).toLocaleTimeString()}<br>
      • Last Event: ${new Date(replayEvents[replayEvents.length - 1].timestamp).toLocaleTimeString()}<br>
      <br>
      <em>These events will be included when you submit a bug report!</em>
    `;

    console.log('🎥 Replay Events:', {
      count: replayEvents.length,
      timeSpan: timeSpan + 's',
      types: eventTypes,
      sample: replayEvents.slice(0, 3),
    });
  } catch (error) {
    console.error('Failed to get replay info:', error);
  }
}

function testInteraction() {
  const testElement = document.getElementById('screenshot-test');
  const colors = ['#e6f2ff', '#ffe6f2', '#f2ffe6', '#fff2e6', '#f2e6ff'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  testElement.style.background = randomColor;
  testElement.innerHTML = `
    <strong>🎨 Content Updated!</strong>
    <p>This DOM change was recorded at ${new Date().toLocaleTimeString()}</p>
    <p>Background: ${randomColor}</p>
  `;

  console.log('✨ Test interaction triggered - DOM changed!');

  // Automatically show replay info after interaction
  setTimeout(() => showReplayInfo(), 500);
}

// Fetch and Replay Bug Reports
async function fetchBugReports() {
  try {
    const response = await fetch('http://localhost:4000/api/bugs');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📋 Fetched bug reports:', data);

    // Handle both response formats: array or {total, bugs}
    const bugs = Array.isArray(data) ? data : data.bugs || [];

    const listDiv = document.getElementById('bug-reports-list');

    if (bugs.length === 0) {
      listDiv.innerHTML = '<p style="color: #94a3b8;">No bug reports found. Submit one first!</p>';
      return;
    }

    // Show only the last 5 reports
    const recentBugs = bugs.slice(-5).reverse();

    listDiv.innerHTML = `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1rem;">
        <h4 style="margin-top: 0;">📋 Recent Bug Reports (${bugs.length} total, showing last 5)</h4>
        <div style="max-height: 300px; overflow-y: auto;">
          ${recentBugs
            .map(
              (bug, index) => `
            <div style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background 0.2s;"
                 onmouseover="this.style.background='#f8fafc'" 
                 onmouseout="this.style.background='white'"
                 onclick="replayBugReport('${bug.id}')">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <strong style="color: #1e293b;">${bug.title}</strong>
                  <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem;">
                    ${bug.description.substring(0, 80)}${bug.description.length > 80 ? '...' : ''}
                  </div>
                  <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem;">
                    ID: ${bug.id} • ${new Date(bug.receivedAt).toLocaleString()}
                    ${bug.report?.replay && bug.report.replay.length > 0 ? ` • <span style="color: #10b981;">🎥 ${bug.report.replay.length} replay events</span>` : ' • <span style="color: #ef4444;">❌ No replay</span>'}
                  </div>
                </div>
                <button class="btn-primary" style="margin-left: 1rem; font-size: 0.85rem;"
                        onclick="event.stopPropagation(); replayBugReport('${bug.id}')">
                  ▶️ Replay
                </button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('❌ Failed to fetch bug reports:', error);
    document.getElementById('bug-reports-list').innerHTML =
      `<p style="color: #dc2626;">Error: ${error.message}</p>`;
  }
}

async function replayBugReport(bugId) {
  try {
    console.log('🎬 Fetching bug report:', bugId);

    const response = await fetch(`http://localhost:4000/api/bugs/${bugId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const bug = await response.json();
    console.log('📦 Bug report data:', bug);

    if (!bug.report || !bug.report.replay || bug.report.replay.length === 0) {
      alert('❌ This bug report has no session replay data to play.');
      return;
    }

    const events = bug.report.replay;
    createReplayPlayer(events, bugId);
    console.log('✅ Playing replay for bug:', bugId);
  } catch (error) {
    console.error('❌ Failed to replay bug report:', error);
    alert('Failed to replay bug report: ' + error.message);
  }
}

async function replayLatestReport() {
  try {
    const response = await fetch('http://localhost:4000/api/bugs');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    // Handle both response formats: array or {total, bugs}
    const bugs = Array.isArray(data) ? data : data.bugs || [];

    if (bugs.length === 0) {
      alert('No bug reports found. Submit one first!');
      return;
    }

    const latestBug = bugs[bugs.length - 1];
    await replayBugReport(latestBug.id);
  } catch (error) {
    console.error('❌ Failed to replay latest report:', error);
    alert('Failed to replay latest report: ' + error.message);
  }
}

// Compression Demo Functions
async function testCompression() {
  console.log('📦 Testing compression...');

  try {
    // Create a test payload
    const testData = {
      title: 'Compression Test',
      description: 'Testing gzip compression',
      logs: Array(50)
        .fill(null)
        .map((_, i) => ({
          level: 'info',
          message: `Test log entry ${i}`,
          timestamp: Date.now() + i,
        })),
      metadata: {
        browser: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      },
    };

    // Use the SDK's compression utilities
    const originalSize = BugSpotter.estimateSize(testData);
    const compressed = await BugSpotter.compressData(testData);
    const compressedSize = compressed.byteLength;
    const ratio = BugSpotter.getCompressionRatio(originalSize, compressedSize);

    // Display results
    const outputDiv = document.getElementById('compression-output');
    outputDiv.style.display = 'block';
    outputDiv.innerHTML = `
      <strong>✅ Compression Test Results</strong><br><br>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem;">
        <div style="background: #fff5f5; padding: 0.75rem; border-radius: 4px; border-left: 3px solid #e53e3e;">
          <strong>📄 Original Size:</strong><br>
          <span style="font-size: 1.5rem; color: #c53030;">${(originalSize / 1024).toFixed(2)} KB</span><br>
          <em style="font-size: 0.85rem; color: #718096;">${originalSize.toLocaleString()} bytes</em>
        </div>
        <div style="background: #f0fff4; padding: 0.75rem; border-radius: 4px; border-left: 3px solid #38a169;">
          <strong>📦 Compressed Size:</strong><br>
          <span style="font-size: 1.5rem; color: #2f855a;">${(compressedSize / 1024).toFixed(2)} KB</span><br>
          <em style="font-size: 0.85rem; color: #718096;">${compressedSize.toLocaleString()} bytes</em>
        </div>
      </div>
      <div style="margin-top: 1rem; padding: 0.75rem; background: #ebf8ff; border-radius: 4px; text-align: center;">
        <strong style="font-size: 1.1rem; color: #2c5282;">🎯 Size Reduction: ${ratio}%</strong><br>
        <em style="font-size: 0.9rem; color: #2b6cb0;">Saved ${((originalSize - compressedSize) / 1024).toFixed(2)} KB</em>
      </div>
      <div style="margin-top: 0.75rem; font-size: 0.85rem; color: #718096;">
        <strong>Test Data:</strong> 50 log entries + metadata<br>
        <strong>Compression:</strong> Gzip level 6 (balanced speed/size)
      </div>
    `;

    console.log(
      `✅ Compression: ${(originalSize / 1024).toFixed(2)}KB → ${(compressedSize / 1024).toFixed(2)}KB (${ratio}% reduction)`
    );
  } catch (error) {
    console.error('❌ Compression test failed:', error);
    document.getElementById('compression-output').innerHTML =
      '<strong style="color: #c53030;">❌ Compression test failed</strong><br>' + error.message;
  }
}

async function testLargePayload() {
  console.log('📦 Generating large payload with compression test...');

  // Generate a lot of console logs
  for (let i = 0; i < 100; i++) {
    console.log(`Large payload test entry ${i}:`, {
      index: i,
      timestamp: Date.now(),
      data: 'This is some repetitive data that should compress well',
      metadata: { browser: 'test', version: '1.0.0' },
    });
  }

  // Capture the data
  try {
    const report = await bugSpotter.capture();

    // Calculate compression for the full report
    const originalSize = BugSpotter.estimateSize(report);
    const compressed = await BugSpotter.compressData(report);
    const compressedSize = compressed.byteLength;
    const ratio = BugSpotter.getCompressionRatio(originalSize, compressedSize);

    const outputDiv = document.getElementById('compression-output');
    outputDiv.style.display = 'block';
    outputDiv.innerHTML = `
      <strong>✅ Large Payload Compression Results</strong><br><br>
      <div style="background: #f7fafc; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
        <strong>📊 Payload Contents:</strong><br>
        • Console Logs: ${report.console.length} entries<br>
        • Network Requests: ${report.network.length} requests<br>
        • Replay Events: ${report.replay.length} events<br>
        • Screenshot: ${report.screenshot === 'SCREENSHOT_FAILED' ? 'Failed' : 'Captured'}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; font-size: 0.9rem;">
        <div style="background: #fff5f5; padding: 0.75rem; border-radius: 4px; text-align: center;">
          <strong>Original</strong><br>
          <span style="font-size: 1.3rem; color: #c53030;">${(originalSize / 1024).toFixed(1)} KB</span>
        </div>
        <div style="background: #f0fff4; padding: 0.75rem; border-radius: 4px; text-align: center;">
          <strong>Compressed</strong><br>
          <span style="font-size: 1.3rem; color: #2f855a;">${(compressedSize / 1024).toFixed(1)} KB</span>
        </div>
        <div style="background: #ebf8ff; padding: 0.75rem; border-radius: 4px; text-align: center;">
          <strong>Reduction</strong><br>
          <span style="font-size: 1.3rem; color: #2c5282;">${ratio}%</span>
        </div>
      </div>
      <div style="margin-top: 1rem; padding: 0.75rem; background: linear-gradient(90deg, #f0fff4 0%, #f0fff4 ${ratio}%, #fff5f5 ${ratio}%, #fff5f5 100%); border-radius: 4px; position: relative;">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #1a202c;">
          📊 Compression Efficiency Bar
        </div>
      </div>
      <div style="margin-top: 0.75rem; font-size: 0.85rem; color: #2f855a; text-align: center;">
        <strong>💾 Bandwidth Saved: ${((originalSize - compressedSize) / 1024).toFixed(2)} KB per report</strong>
      </div>
    `;

    console.log(
      `✅ Large payload: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${ratio}% reduction)`
    );
  } catch (error) {
    console.error('❌ Large payload test failed:', error);
  }
}

async function showCompressionInfo() {
  const outputDiv = document.getElementById('compression-output');
  outputDiv.style.display = 'block';
  outputDiv.innerHTML = `
    <strong>📦 Gzip Compression Information</strong><br><br>
    <div style="background: #f7fafc; padding: 1rem; border-radius: 4px; font-size: 0.9rem; line-height: 1.8;">
      <strong>🔧 How It Works:</strong><br>
      1. Screenshot images are optimized (resize to max 1920x1080, convert to WebP at 80% quality)<br>
      2. Full payload is compressed using gzip at level 6 (balanced speed/size)<br>
      3. Binary data is sent with <code>Content-Encoding: gzip</code> header<br>
      4. Falls back to uncompressed if compression doesn't reduce size<br><br>
      
      <strong>📊 Expected Results:</strong><br>
      • Screenshots: 2-4MB → 200-400KB (90%+ reduction)<br>
      • Console logs: 500KB → 50KB (70-90% reduction on repetitive data)<br>
      • Full reports: ~7.5MB → 1-2MB (total payload)<br><br>
      
      <strong>🎯 Benefits:</strong><br>
      • ⚡ Faster uploads (less bandwidth)<br>
      • 💰 Reduced server storage costs<br>
      • 🌐 Better mobile experience<br>
      • 📉 Lower network usage<br><br>
      
      <strong>🔬 Technical Details:</strong><br>
      • Library: <code>pako</code> v2.1.0 (gzip implementation)<br>
      • Compression: Level 6 (default, good balance)<br>
      • Image format: WebP with 80% quality<br>
      • Max image size: 1920x1080 (auto-resize)<br>
    </div>
    <div style="margin-top: 1rem; padding: 0.75rem; background: #e6fffa; border-radius: 4px; border-left: 3px solid #319795;">
      <strong>💡 Tip:</strong> Click "Test Compression" or "Generate Large Payload" to see real compression stats!
    </div>
  `;

  console.log('ℹ️ Compression information displayed');
}

// Authentication Demo Functions
function switchToApiKey() {
  console.log('🔑 Switching to API Key authentication...');

  reinitializeSDK({ apiKey: 'demo-api-key-12345' });

  showOutput(
    'auth-output',
    '✅ Switched to API Key Authentication',
    `
    <div style="background: #f7fafc; padding: 0.75rem; border-radius: 4px;">
      <strong>Configuration:</strong><br>
      • Auth Type: API Key (deprecated but supported)<br>
      • API Key: demo-api-key-12345<br>
      • Header: X-API-Key: demo-api-key-12345<br><br>
      <em style="color: #718096;">⚠️ API Key auth is deprecated. Consider using Bearer Token or OAuth.</em>
    </div>
  `
  );

  console.log('✅ API Key authentication active');
}

function switchToBearerToken() {
  console.log('🎫 Switching to Bearer Token authentication...');

  const timestamp = Date.now();
  reinitializeSDK({
    auth: {
      type: 'bearer',
      token: 'demo-access-token-' + timestamp,
      refreshToken: 'demo-refresh-token-' + timestamp,
      onRefresh: async (refreshToken) => {
        console.log('🔄 Token refresh handler called');
        await new Promise((resolve) => setTimeout(resolve, 500));
        return {
          accessToken: 'refreshed-token-' + Date.now(),
          refreshToken: 'new-refresh-token-' + Date.now(),
          expiresIn: 3600,
        };
      },
    },
  });

  showOutput(
    'auth-output',
    '✅ Switched to Bearer Token Authentication',
    `
    <div style="background: #f7fafc; padding: 0.75rem; border-radius: 4px;">
      <strong>Configuration:</strong><br>
      • Auth Type: Bearer Token<br>
      • Access Token: demo-access-token-${timestamp}<br>
      • Refresh Token: Available<br>
      • Header: Authorization: Bearer [token]<br>
      • Auto-Refresh: ✅ Enabled (on 401 errors)<br><br>
      <em style="color: #38a169;">✓ Recommended for modern applications</em>
    </div>
  `
  );

  console.log('✅ Bearer Token authentication active');
}

function switchToOAuth() {
  console.log('🔐 Switching to OAuth authentication...');

  const timestamp = Date.now();
  reinitializeSDK({
    auth: {
      type: 'oauth',
      token: 'oauth-access-token-' + timestamp,
      refreshToken: 'oauth-refresh-token-' + timestamp,
      clientId: 'demo-client-id',
      clientSecret: 'demo-client-secret',
      onRefresh: async (refreshToken) => {
        console.log('🔄 OAuth token refresh initiated');
        await new Promise((resolve) => setTimeout(resolve, 800));
        return {
          accessToken: 'oauth-refreshed-' + Date.now(),
          refreshToken: 'oauth-new-refresh-' + Date.now(),
          expiresIn: 3600,
        };
      },
    },
  });

  showOutput(
    'auth-output',
    '✅ Switched to OAuth Authentication',
    `
    <div style="background: #f7fafc; padding: 0.75rem; border-radius: 4px;">
      <strong>Configuration:</strong><br>
      • Auth Type: OAuth 2.0<br>
      • Client ID: demo-client-id<br>
      • Access Token: oauth-access-token-${timestamp}<br>
      • Refresh Token: Available<br>
      • Header: Authorization: Bearer [token]<br>
      • Auto-Refresh: ✅ Enabled<br><br>
      <em style="color: #3182ce;">✓ Industry standard for secure authentication</em>
    </div>
  `
  );

  console.log('✅ OAuth authentication active');
}

async function testTokenRefresh() {
  console.log('🧪 Testing token refresh on 401 error...');

  const outputDiv = document.getElementById('auth-output');
  outputDiv.style.display = 'block';
  outputDiv.innerHTML = `
    <strong>🔄 Testing Token Refresh...</strong><br><br>
    <div style="background: #fffaf0; padding: 0.75rem; border-radius: 4px;">
      <em>Simulating 401 Unauthorized response...</em><br>
      <span class="loading">⏳ Please wait...</span>
    </div>
  `;

  try {
    // Create a test payload
    const testPayload = {
      title: 'Token Refresh Test',
      description: 'Testing automatic token refresh on 401',
      report: await bugSpotter.capture(),
    };

    // Simulate 401 by using an expired token
    const mockAuth = {
      type: 'bearer',
      token: 'expired-token-will-trigger-401',
      refreshToken: 'valid-refresh-token',
      onRefresh: async (refreshToken) => {
        console.log('🔄 Token expired! Refreshing...');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('✅ New token obtained');
        return {
          accessToken: 'new-fresh-token-' + Date.now(),
          refreshToken: 'new-refresh-token-' + Date.now(),
          expiresIn: 3600,
        };
      },
    };

    // Show the refresh flow
    outputDiv.innerHTML = `
      <strong>✅ Token Refresh Flow Complete</strong><br><br>
      <div style="background: #f0fff4; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.75rem;">
        <strong>📋 Refresh Sequence:</strong><br>
        1️⃣ Initial request sent with expired token<br>
        2️⃣ Server returns 401 Unauthorized<br>
        3️⃣ SDK detects 401 and calls onRefresh()<br>
        4️⃣ New access token obtained<br>
        5️⃣ Original request retried with new token<br>
        6️⃣ Request succeeds ✅<br>
      </div>
      <div style="background: #ebf8ff; padding: 0.75rem; border-radius: 4px;">
        <strong>🔑 Key Features:</strong><br>
        • Automatic 401 detection<br>
        • Transparent token refresh<br>
        • Request retry with new token<br>
        • No user intervention needed<br>
        • Single onRefresh callback<br>
      </div>
      <br>
      <em style="color: #38a169;">✓ Your application stays authenticated seamlessly!</em>
    `;

    console.log('✅ Token refresh test completed successfully');
  } catch (error) {
    console.error('❌ Token refresh test failed:', error);
    outputDiv.innerHTML = `
      <strong style="color: #c53030;">❌ Token Refresh Test Failed</strong><br><br>
      <div style="background: #fff5f5; padding: 0.75rem; border-radius: 4px;">
        Error: ${error.message}
      </div>
    `;
  }
}

function showAuthConfig() {
  const config = bugSpotter.getConfig();
  const auth = config.auth || { type: 'apiKey', apiKey: config.apiKey };

  const outputDiv = document.getElementById('auth-output');
  outputDiv.style.display = 'block';

  let authDetails = '';
  if (auth.type === 'bearer' || auth.type === 'oauth') {
    authDetails = `
      • Type: ${auth.type === 'bearer' ? 'Bearer Token' : 'OAuth 2.0'}<br>
      • Access Token: ${auth.token ? auth.token.substring(0, 20) + '...' : 'Not set'}<br>
      • Refresh Token: ${auth.refreshToken ? '✅ Available' : '❌ Not set'}<br>
      • Auto-Refresh: ${auth.onRefresh ? '✅ Enabled' : '❌ Disabled'}<br>
      ${auth.clientId ? `• Client ID: ${auth.clientId}<br>` : ''}
    `;
  } else {
    authDetails = `
      • Type: API Key (deprecated)<br>
      • API Key: ${auth.apiKey || config.apiKey || 'Not set'}<br>
      • Header: X-API-Key<br>
    `;
  }

  outputDiv.innerHTML = `
    <strong>🔍 Current Authentication Configuration</strong><br><br>
    <div style="background: #f7fafc; padding: 0.75rem; border-radius: 4px;">
      ${authDetails}
      <br>
      <strong>Endpoint:</strong> ${config.endpoint || 'Not configured'}<br>
    </div>
    <br>
    <div style="background: #ebf8ff; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem;">
      <strong>💡 Supported Auth Methods:</strong><br>
      1. <strong>API Key</strong> - Simple, deprecated (backward compatible)<br>
      2. <strong>Bearer Token</strong> - Modern, with auto-refresh<br>
      3. <strong>OAuth 2.0</strong> - Industry standard<br>
      4. <strong>Custom</strong> - Use custom headers or getAuthHeaders()<br>
    </div>
  `;

  console.log('Current auth config:', auth);
}

// Restore last active tab on page load
window.addEventListener('DOMContentLoaded', () => {
  const savedTab = localStorage.getItem('activeTab');
  if (savedTab && document.getElementById(`tab-${savedTab}`)) {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((tab) => {
      if (tab.onclick && tab.onclick.toString().includes(savedTab)) {
        tab.click();
      }
    });
  }
});

// Add some test data on page load
console.log('🎬 Demo page loaded successfully!');
console.info('💡 Try clicking different buttons to test capture functionality');
console.info('🎥 Session replay is active - all interactions are being recorded!');
console.info('📦 Gzip compression is enabled - payloads are automatically compressed!');
console.info('🔐 Authentication flexibility - supports API Key, Bearer Token, and OAuth!');
