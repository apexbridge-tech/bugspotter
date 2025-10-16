import { useEffect, useRef } from 'react';
import type { Session } from '../../types';

interface SessionReplayPlayerProps {
  session: Session;
  className?: string;
}

export function SessionReplayPlayer({ session, className = '' }: SessionReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !session?.events?.recordedEvents) {
      return;
    }

    // Dynamically import rrweb-player to avoid SSR issues
    const loadPlayer = async () => {
      try {
        const rrwebPlayer = await import('rrweb-player');
        const { default: rrwebPlayerDefault } = rrwebPlayer;

        // Clear previous player
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Create new player instance
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new rrwebPlayerDefault({
          target: containerRef.current!,
          props: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            events: session.events.recordedEvents as any,
            width: containerRef.current!.offsetWidth,
            height: 600,
            autoPlay: false,
            showController: true,
            skipInactive: true,
            speed: 1,
          },
        });
      } catch (error) {
        console.error('Failed to load rrweb player:', error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="flex items-center justify-center h-[600px] bg-gray-100 rounded-lg">
              <div class="text-center text-gray-500">
                <p class="mb-2">❌ Failed to load session replay player</p>
                <p class="text-sm">rrweb-player package may not be installed</p>
              </div>
            </div>
          `;
        }
      }
    };

    loadPlayer();
  }, [session]);

  if (!session?.events?.recordedEvents || session.events.recordedEvents.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[600px] bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center text-gray-500">
          <p className="mb-2">📹 No session replay available</p>
          <p className="text-sm">This bug report does not have recorded events</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="rounded-lg overflow-hidden shadow-inner" />
    </div>
  );
}
