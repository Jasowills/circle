import { Injectable, Logger } from '@nestjs/common';

/**
 * Decoupled event bus for circle-room broadcasts.
 * The WebSocket gateway registers itself here; the domain service emits
 * without knowing whether anyone is listening (keeps service unit-testable).
 */
@Injectable()
export class CircleEvents {
  private readonly logger = new Logger('WS');
  private emitter: ((room: string, event: string, payload: unknown) => void) | null = null;

  register(emitter: (room: string, event: string, payload: unknown) => void) {
    this.emitter = emitter;
  }

  roomFor(circleId: string): string {
    return `circle:${circleId}`;
  }

  contributionCreated(circleId: string, payload: { entryId: string; userId: string; amount: string }) {
    this.broadcast(circleId, 'contribution.created', payload);
  }

  memberJoined(circleId: string, payload: { userId: string; status: string }) {
    this.broadcast(circleId, 'member.joined', payload);
  }

  statusChanged(circleId: string, payload: { from: string; to: string }) {
    this.broadcast(circleId, 'circle.status_changed', payload);
  }

  private broadcast(circleId: string, event: string, payload: unknown) {
    this.logger.log(JSON.stringify({ event: 'ws.broadcast', room: this.roomFor(circleId), type: event }));
    this.emitter?.(this.roomFor(circleId), event, payload);
  }
}
