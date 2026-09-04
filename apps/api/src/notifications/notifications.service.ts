import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Notice {
  id: string;
  kind:
    | 'payout_received'
    | 'goal_hit'
    | 'member_joined'
    | 'contribute_due'
    | 'collect_soon'
    | 'payout_countdown'
    | 'invite_pending';
  title: string;
  body: string;
  circleId: string | null;
  at: Date;
}

const DAY = 86400000;

/**
 * Everything here is derived from existing rows. No notification table, no
 * push infra: the same facts that drive the app, reframed as a timeline.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: string): Promise<Notice[]> {
    const out: Notice[] = [];
    const memberships = await this.prisma.circleMembership.findMany({
      where: { userId },
      include: { circle: { select: { id: true, name: true, status: true } } },
    });
    const myCircleIds = memberships.map((m) => m.circleId);

    for (const m of memberships) {
      // Pending invites.
      if (m.status === 'invited') {
        out.push({
          id: `invite-${m.circleId}`,
          kind: 'invite_pending',
          title: `You're invited to ${m.circle.name}`,
          body: 'Accept it to start contributing.',
          circleId: m.circleId,
          at: m.invitedAt,
        });
      }
      // Finished circles I belong to.
      if (m.status === 'active' && (m.circle.status === 'completed' || m.circle.status === 'goal_reached')) {
        const lastCycle = await this.prisma.circleCycle.findFirst({
          where: { circleId: m.circleId, status: 'payout_completed' },
          orderBy: { cycleNumber: 'desc' },
        });
        out.push({
          id: `goal-${m.circleId}`,
          kind: 'goal_hit',
          title: `${m.circle.name} hit its goal`,
          body: 'Every cycle paid out. Well done, everyone.',
          circleId: m.circleId,
          at: lastCycle?.endsAt ?? m.invitedAt,
        });
      }
    }

    if (myCircleIds.length) {
      // Fresh faces in my circles (last 14 days, not me).
      const joins = await this.prisma.circleMembership.findMany({
        where: {
          circleId: { in: myCircleIds },
          status: 'active',
          userId: { not: userId },
          joinedAt: { gte: new Date(Date.now() - 14 * DAY) },
        },
        include: { user: { select: { name: true } }, circle: { select: { id: true, name: true } } },
        orderBy: { joinedAt: 'desc' },
        take: 10,
      });
      for (const j of joins) {
        out.push({
          id: `join-${j.circleId}-${j.userId}`,
          kind: 'member_joined',
          title: `${j.user.name} joined ${j.circle.name}`,
          body: 'Say hello. The rotation just got stronger.',
          circleId: j.circleId,
          at: j.joinedAt ?? j.invitedAt,
        });
      }

      // Collecting cycles in my circles: dues, collections, countdowns.
      const collecting = await this.prisma.circleCycle.findMany({
        where: { circleId: { in: myCircleIds }, status: 'collecting' },
        include: { circle: { select: { id: true, name: true } } },
      });
      for (const c of collecting) {
        const mine = await this.prisma.ledgerEntry.count({
          where: { circleId: c.circleId, cycleId: c.id, userId },
        });
        if (mine === 0) {
          const isMine = c.recipientId === userId;
          out.push({
            id: `due-${c.id}`,
            kind: 'contribute_due',
            title: isMine ? `Top up your own pot · ${c.circle.name}` : `Time to contribute · ${c.circle.name}`,
            body: `Cycle ${c.cycleNumber} is collecting. Every share moves the payout closer.`,
            circleId: c.circleId,
            at: c.startsAt,
          });
        }
        if (c.recipientId === userId) {
          out.push({
            id: `collect-${c.id}`,
            kind: 'collect_soon',
            title: `You collect cycle ${c.cycleNumber} · ${c.circle.name}`,
            body: `₦${Number(c.targetPot).toLocaleString()} comes to your wallet when the pot fills.`,
            circleId: c.circleId,
            at: c.startsAt,
          });
        }
        const days = Math.ceil((c.endsAt.getTime() - Date.now()) / DAY);
        if (days <= 3) {
          out.push({
            id: `countdown-${c.id}`,
            kind: 'payout_countdown',
            title: days <= 0 ? `Payout due · ${c.circle.name}` : `Next payout in ${days}d · ${c.circle.name}`,
            body: `Cycle ${c.cycleNumber} closes ${days <= 0 ? 'now' : `in ${days} day${days === 1 ? '' : 's'}`}.`,
            circleId: c.circleId,
            at: c.endsAt,
          });
        }
      }

      // Money that already landed in my wallet.
      const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
      if (wallet) {
        const payouts = await this.prisma.walletTransaction.findMany({
          where: { walletId: wallet.id, type: 'circle_payout' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        for (const p of payouts) {
          const circle = p.relatedCircleId
            ? await this.prisma.circle.findUnique({ where: { id: p.relatedCircleId }, select: { name: true } })
            : null;
          out.push({
            id: `payout-${p.id}`,
            kind: 'payout_received',
            title: `You received ₦${Number(p.amount).toLocaleString()}`,
            body: circle ? `Cycle payout from ${circle.name}.` : 'Cycle payout landed in your wallet.',
            circleId: p.relatedCircleId,
            at: p.createdAt,
          });
        }
      }
    }

    return out.sort((a, b) => +b.at - +a.at).slice(0, 30);
  }
}
