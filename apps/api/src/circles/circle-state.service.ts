import { Injectable, Logger } from '@nestjs/common';
import { CircleStatus } from '@prisma/client';

export interface CircleSnapshot {
  id: string;
  status: CircleStatus;
  goalAmount: number;
  targetMembers?: number | null;

  autoActivates?: boolean;
}

@Injectable()
export class CircleStateService {
  private readonly logger = new Logger('CircleState');

  nextStatus(
    snapshot: CircleSnapshot,
    activeMemberCount: number,
    balance: number,
  ): CircleStatus | null {
    const needed = snapshot.targetMembers && snapshot.targetMembers >= 2 ? snapshot.targetMembers : 2;
    if (snapshot.status === 'forming' && snapshot.autoActivates !== false && activeMemberCount >= needed) {
      return 'active';
    }
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
