# Session Replay Demo

## Overview

The BugSpotter demo now includes a **live session replay player** that lets you see recorded user interactions in real-time!

## How to Use

### 1. Start the Demo

The demo is already running at **http://localhost:3000/apps/demo/index.html**

### 2. Interact with the Page

Click around, scroll, type in forms - all your interactions are being recorded in a 30-second circular buffer.

### 3. Play Your Session Replay

1. Scroll to the **🎥 Session Replay** section
2. Click **▶️ Play Session Replay** button
3. Watch your interactions play back in real-time!

### 4. Player Controls

Once the replay player opens, you can:

- **▶️ Play** - Start/resume playback
- **⏸️ Pause** - Pause the replay
- **2x Speed** - Double playback speed
- **1x Speed** - Normal playback speed
- **⏹️ Close** - Close the player

The player also has a built-in timeline scrubber that lets you jump to any point in the recording.

## What Gets Recorded?

The session replay captures:

- ✅ **DOM Changes** - Elements added/removed/modified
- ✅ **Mouse Movements** - Cursor position (throttled to 50ms)
- ✅ **Clicks** - All mouse interactions
- ✅ **Scrolling** - Page scroll events (throttled to 100ms)
- ✅ **Form Input** - Text typed into fields
- ✅ **Window Resizes** - Viewport changes

## Technical Details

### Dependencies

The demo uses:
- **rrweb** - Records DOM events (already included in BugSpotter SDK)
- **rrweb-player** - Plays back recorded events (loaded via CDN)

### How It Works

1. **Recording**: BugSpotter SDK automatically records events using rrweb
2. **Circular Buffer**: Only the last 30 seconds of events are kept
3. **Playback**: When you click "Play", the events are passed to rrweb-player
4. **Replay**: The player reconstructs the DOM and replays all interactions

### Event Types

You'll see these event types in the replay:

| Type | Description |
|------|-------------|
| 0 | DomContentLoaded |
| 1 | Load |
| 2 | FullSnapshot (complete DOM snapshot) |
| 3 | IncrementalSnapshot (changes/interactions) |
| 4 | Meta (page info, viewport, URL) |

## Try These Tests

1. **Test Interaction Button**
   - Click "Test Interaction" to trigger DOM changes
   - Then play the replay to see them

2. **Console & Network Tests**
   - Click various test buttons
   - Play replay to see the full context

3. **Form Input**
   - Type in the bug report form
   - Watch it replay with your typing

4. **Submit a Bug Report**
   - The replay events are automatically included
   - Check the backend logs to see replay data

## Privacy & Performance

- **No sensitive data** is recorded (passwords are masked)
- **Throttled events** keep performance optimal
- **30-second buffer** limits memory usage
- **Slim DOM** options reduce payload size

## Troubleshooting

### "No replay events captured yet"

- Wait a few seconds after page load
- Interact with the page (click, scroll, etc.)
- Try the "Test Interaction" button first

### Player Not Loading

- Check browser console for errors
- Ensure rrweb-player CDN is accessible
- Try refreshing the page

### Replay Looks Choppy

- This is normal for throttled mouse movements
- Reduce playback speed to 1x for smoother viewing
- More events = smoother replay (but more memory)

## Next Steps

After testing the replay:

1. Submit a bug report (floating button or "Generate Report")
2. Check the backend logs at http://localhost:4000
3. See how replay events are included in the bug report
4. View the stored data in `/packages/backend-mock/db.json`

## Resources

- [rrweb Documentation](https://www.rrweb.io/)
- [BugSpotter Session Replay Docs](../../packages/sdk/docs/SESSION_REPLAY.md)
- [BugSpotter README](../../README.md)
