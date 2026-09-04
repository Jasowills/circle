import { Injectable, Logger } from '@nestjs/common';

/**
 * Lets the domain service emit room broadcasts without importing the
 * gateway. The gateway plugs itself in via register(); with nothing
 * registered, broadcasting is a logged no-op.
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

  payoutCompleted(circleId: string, payload: { cycleId: string; cycleNumber: number; recipientId: string; amount: string }) {
    this.broadcast(circleId, 'payout.completed', payload);
  }

  payoutPending(circleId: string, payload: { cycleId: string; cycleNumber: number; recipientId: string; amount: string }) {
    this.broadcast(circleId, 'payout.pending', payload);
  }

  cycleAdvanced(circleId: string, payload: { cycleId: string; cycleNumber: number; recipientId: string }) {
    this.broadcast(circleId, 'cycle.advanced', payload);
  }

  private broadcast(circleId: string, event: string, payload: unknown) {
    this.logger.log(JSON.stringify({ event: 'ws.broadcast', room: this.roomFor(circleId), type: event }));
    this.emitter?.(this.roomFor(circleId), event, payload);
  }
}
