import { Injectable, Logger } from '@nestjs/common';
import { CircleStatus } from '@prisma/client';

export interface CircleSnapshot {
  id: string;
  status: CircleStatus;
  goalAmount: number;
}

/**
 * THE single place circle transitions are decided (spec §7).
 * Controllers/services call `evaluate()` — they never inline `if` checks.
 *
 *   forming --(>=2 active members)--> active
 *   active  --(balance >= goal)-----> goal_reached
 *   active|goal_reached --(creator)--> closed   (explicit close action only)
 */
@Injectable()
export class CircleStateService {
  private readonly logger = new Logger('CircleState');

  /** Pure decision function — trivially unit-testable, no DB. */
  nextStatus(
    snapshot: CircleSnapshot,
    activeMemberCount: number,
    balance: number,
  ): CircleStatus | null {
    if (snapshot.status === 'forming' && activeMemberCount >= 2) return 'active';
    if (snapshot.status === 'active' && balance >= snapshot.goalAmount) return 'goal_reached';
    return null;
  }

  canClose(status: CircleStatus): boolean {
    return status === 'active' || status === 'goal_reached';
  }

  logTransition(circleId: string, from: CircleStatus, to: CircleStatus, reason: string) {
    this.logger.log(JSON.stringify({ event: 'circle.status_changed', circleId, from, to, reason }));
  }
}
