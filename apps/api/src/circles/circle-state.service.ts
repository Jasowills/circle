import { Injectable, Logger } from '@nestjs/common';
import { CircleStatus } from '@prisma/client';

export interface CircleSnapshot {
  id: string;
  status: CircleStatus;
  goalAmount: number;
  targetMembers?: number | null;
}

/**
 * Status decisions live here and nowhere else. Call nextStatus() instead of
 * inlining `if` checks in controllers or services.
 *
 *   forming --(full: activeMembers >= targetMembers, else >= 2)--> active
 *   active  --(balance >= goal, legacy goal circles)-------------> goal_reached
 *   active  --(last cycle paid, rotation circles)----------------> completed
 *   active|goal_reached|completed --(creator)--> closed
 */
@Injectable()
export class CircleStateService {
  private readonly logger = new Logger('CircleState');

  /** Pure function, no DB. Plain unit tests cover it. */
  nextStatus(
    snapshot: CircleSnapshot,
    activeMemberCount: number,
    balance: number,
  ): CircleStatus | null {
    const needed = snapshot.targetMembers && snapshot.targetMembers >= 2 ? snapshot.targetMembers : 2;
    if (snapshot.status === 'forming' && activeMemberCount >= needed) return 'active';
    if (snapshot.status === 'active' && balance >= snapshot.goalAmount) return 'goal_reached';
    return null;
  }

  canClose(status: CircleStatus): boolean {
    return status === 'active' || status === 'goal_reached' || status === 'completed';
  }

  logTransition(circleId: string, from: string, to: string, reason: string) {
    this.logger.log(JSON.stringify({ event: 'circle.status_changed', circleId, from, to, reason }));
  }
}
