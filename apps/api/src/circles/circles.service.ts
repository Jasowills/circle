import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CircleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { CircleStateService } from './circle-state.service';
import { CircleEvents } from '../realtime/circle-events';

@Injectable()
export class CirclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly wallet: WalletService,
    private readonly state: CircleStateService,
    private readonly events: CircleEvents,
  ) {}

  async create(
    creatorId: string,
    name: string,
    goalAmount: number,
    currency?: string,
    rotation?: { contributionAmount?: number; targetMembers?: number; cycleLengthDays?: number },
  ) {
    const circle = await this.prisma.circle.create({
      data: {
        name: name.trim(),
        goalAmount,
        currency: (currency ?? 'NGN').toUpperCase(),
        createdById: creatorId,
        contributionAmount: rotation?.contributionAmount,
        targetMembers: rotation?.targetMembers,
        cycleLengthDays: rotation?.cycleLengthDays ?? 7,
        memberships: {
          create: { userId: creatorId, role: 'creator', status: 'active', joinedAt: new Date() },
        },
      },
      include: { memberships: true },
    });
    return this.detail(circle.id, creatorId);
  }

  /** Public forming circles the viewer hasn't joined. Searchable by name. */
  async discover(viewerId: string, q?: string) {
    const circles = await this.prisma.circle.findMany({
      where: {
        status: 'forming',
        ...(q?.trim() ? { name: { contains: q.trim(), mode: 'insensitive' } } : {}),
        memberships: { none: { userId: viewerId } },
      },
      include: {
        _count: { select: { memberships: true } },
        memberships: { where: { status: 'active' }, select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return Promise.all(
      circles.map(async (c) => ({
        ...(await this.summarize(c.id)),
        activeMemberIds: c.memberships.map((m) => m.userId),
      })),
    );
  }

  /** Rotation schedule with per-cycle collection progress + recipient names. */
  async cycles(circleId: string, viewerId: string) {
    await this.requireCircle(circleId);
    await this.requireMember(circleId, viewerId);
    const rows = await this.prisma.circleCycle.findMany({
      where: { circleId },
      include: { recipient: { select: { id: true, name: true } } },
      orderBy: { cycleNumber: 'asc' },
    });
    return Promise.all(
      rows.map(async (c) => ({
        id: c.id,
        cycleNumber: c.cycleNumber,
        recipient: c.recipient,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        targetPot: Number(c.targetPot),
        collected: await this.cycleCollected(circleId, c.id),
        status: c.status,
      })),
    );
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.circleMembership.findMany({
      where: { userId },
      include: { circle: true },
      orderBy: { invitedAt: 'desc' },
    });
    return Promise.all(
      memberships.map(async (m) => this.summarize(m.circle.id)),
    );
  }

  async detail(circleId: string, viewerId: string) {
    const circle = await this.prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        memberships: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      },
    });
    if (!circle) throw new NotFoundException('Circle not found');
    const mine = circle.memberships.find((m) => m.userId === viewerId);
    if (!mine) throw new ForbiddenException('You are not a member of this circle');

    const balance = await this.ledger.circleBalance(circleId);
    const goal = Number(circle.goalAmount);
    const members = await Promise.all(
      circle.memberships.map(async (m) => ({
        userId: m.userId,
        user: m.user,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        balance: await this.ledger.memberBalance(circleId, m.userId),
      })),
    );
    return {
      id: circle.id,
      name: circle.name,
      goalAmount: goal,
      currency: circle.currency,
      status: circle.status,
      createdAt: circle.createdAt,
      balance,
      progress: goal > 0 ? Math.min(1, balance / goal) : 0,
      contributionAmount: circle.contributionAmount !== null ? Number(circle.contributionAmount) : null,
      targetMembers: circle.targetMembers,
      cycleLengthDays: circle.cycleLengthDays,
      currentCycle: await this.currentCycleView(circleId),
      myMembership: { role: mine.role, status: mine.status },
      myBalance: await this.ledger.memberBalance(circleId, viewerId),
      members,
    };
  }

  private async currentCycleView(circleId: string) {
    const cycle = await this.prisma.circleCycle.findFirst({
      where: { circleId, status: 'collecting' },
      include: { recipient: { select: { id: true, name: true } } },
    });
    if (!cycle) return null;
    const [collected, total] = await Promise.all([
      this.cycleCollected(circleId, cycle.id),
      this.prisma.circleCycle.count({ where: { circleId } }),
    ]);
    return {
      id: cycle.id,
      cycleNumber: cycle.cycleNumber,
      totalCycles: total,
      recipient: cycle.recipient,
      targetPot: Number(cycle.targetPot),
      collected,
      endsAt: cycle.endsAt,
    };
  }

  async invite(circleId: string, inviterId: string, email: string) {
    const circle = await this.requireCircle(circleId);
    await this.requireActiveMember(circleId, inviterId);
    if (circle.status === 'closed') throw new BadRequestException('Circle is closed');

    const invitee = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!invitee) {
      throw new NotFoundException('No account with that email yet. They need to sign in once first');
    }
    const existing = await this.prisma.circleMembership.findUnique({
      where: { circleId_userId: { circleId, userId: invitee.id } },
    });
    if (existing) throw new BadRequestException('User is already in this circle');

    const membership = await this.prisma.circleMembership.create({
      data: { circleId, userId: invitee.id, role: 'member', status: 'invited' },
    });
    this.events.memberJoined(circleId, { userId: invitee.id, status: 'invited' });
    return membership;
  }

  async accept(circleId: string, userId: string) {
    await this.requireCircle(circleId);
    const membership = await this.prisma.circleMembership.findUnique({
      where: { circleId_userId: { circleId, userId } },
    });
    if (!membership) throw new ForbiddenException('You were not invited to this circle');
    if (membership.status === 'active') return this.detail(circleId, userId);

    await this.prisma.circleMembership.update({
      where: { id: membership.id },
      data: { status: 'active', joinedAt: new Date() },
    });
    this.events.memberJoined(circleId, { userId, status: 'active' });
    await this.applyTransitions(circleId, 'member_accepted');
    return this.detail(circleId, userId);
  }

  /** Open enrollment for public (forming) circles found via discover. */
  async join(circleId: string, userId: string) {
    const circle = await this.requireCircle(circleId);
    const existing = await this.prisma.circleMembership.findUnique({
      where: { circleId_userId: { circleId, userId } },
    });
    if (existing) return this.detail(circleId, userId);
    if (circle.status !== 'forming') throw new BadRequestException('This circle is no longer open to join');
    if (circle.targetMembers !== null) {
      const active = await this.prisma.circleMembership.count({ where: { circleId, status: 'active' } });
      if (active >= circle.targetMembers) throw new BadRequestException('This circle is full');
    }
    await this.prisma.circleMembership.create({
      data: { circleId, userId, role: 'member', status: 'active', joinedAt: new Date() },
    });
    this.events.memberJoined(circleId, { userId, status: 'active' });
    await this.applyTransitions(circleId, 'public_join');
    return this.detail(circleId, userId);
  }

  async contribute(circleId: string, userId: string, amount: number, idempotencyKey: string) {
    const circle = await this.requireCircle(circleId);
    if (circle.status === 'closed' || circle.status === 'completed') {
      throw new BadRequestException('This circle is no longer collecting');
    }
    await this.requireActiveMember(circleId, userId);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }
    // Rotation circles take fixed steps (one or more days at once).
    if (circle.contributionAmount !== null) {
      const step = Number(circle.contributionAmount);
      if (amount % step !== 0) {
        throw new BadRequestException(`This circle takes ₦${step.toLocaleString()} at a time`);
      }
    }
    const key = idempotencyKey.trim();

    // Sequential replay first: the common retry path never touches the wallet.
    const replay = await this.prisma.ledgerEntry.findUnique({
      where: { circleId_userId_idempotencyKey: { circleId, userId, idempotencyKey: key } },
    });
    if (replay) {
      return { entry: this.presentLedger(replay), replayed: true, circle: await this.summarize(circleId) };
    }

    const wallet = await this.wallet.getWallet(userId);
    const currentCycle = await this.prisma.circleCycle.findFirst({
      where: { circleId, status: 'collecting' },
    });

    // Scheduled circles pace contributions: at most N per week, evenly spaced.
    if (currentCycle && circle.contributionsPerWeek) {
      const gap = (circle.cycleLengthDays * 86400000) / circle.contributionsPerWeek;
      const last = await this.prisma.ledgerEntry.findFirst({
        where: { circleId, cycleId: currentCycle.id, userId },
        orderBy: { createdAt: 'desc' },
      });
      if (last && Date.now() - last.createdAt.getTime() < gap) {
        throw new BadRequestException(
          `Next contribution opens in ${this.countdown(last.createdAt.getTime() + gap)}.`,
        );
      }
    }

    // One Postgres transaction: wallet debit + ledger credit, or neither.
    // A race on the key rolls everything back and falls through to replay.
    let entry;
    try {
      entry = await this.prisma.$transaction(async (tx) => {
        const agg = await tx.walletTransaction.aggregate({
          where: { walletId: wallet.id },
          _sum: { amount: true },
        });
        if (Number(agg._sum.amount ?? 0) < amount) {
          throw new BadRequestException('Insufficient wallet balance. Fund your wallet first.');
        }
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -amount,
            type: 'circle_contribution',
            relatedCircleId: circleId,
            relatedCycleId: currentCycle?.id,
            idempotencyKey: `contrib:${key}`,
          },
        });
        return tx.ledgerEntry.create({
          data: { circleId, userId, amount, type: 'contribution', idempotencyKey: key, cycleId: currentCycle?.id },
        });
      });
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
        const winner = await this.prisma.ledgerEntry.findUnique({
          where: { circleId_userId_idempotencyKey: { circleId, userId, idempotencyKey: key } },
        });
        if (winner) {
          return { entry: this.presentLedger(winner), replayed: true, circle: await this.summarize(circleId) };
        }
      }
      throw err;
    }

    this.events.contributionCreated(circleId, { entryId: entry.id, userId, amount: entry.amount.toString() });
    await this.applyTransitions(circleId, 'contribution');
    if (currentCycle) await this.maybePayout(circleId, currentCycle.id);
    return { entry: this.presentLedger(entry), replayed: false, circle: await this.summarize(circleId) };
  }

  /** When this member may next contribute (ISO), or null when unrestricted. */
  async nextContributionAt(circleId: string, userId: string): Promise<string | null> {
    const circle = await this.requireCircle(circleId);
    if (circle.contributionAmount === null || !circle.contributionsPerWeek) return null;
    const currentCycle = await this.prisma.circleCycle.findFirst({
      where: { circleId, status: 'collecting' },
    });
    if (!currentCycle) return null;
    const gap = (circle.cycleLengthDays * 86400000) / circle.contributionsPerWeek;
    const last = await this.prisma.ledgerEntry.findFirst({
      where: { circleId, cycleId: currentCycle.id, userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!last || Date.now() - last.createdAt.getTime() >= gap) return null;
    return new Date(last.createdAt.getTime() + gap).toISOString();
  }

  /** Toggle scheduled auto-contribute for my own membership. */
  async setAuto(circleId: string, userId: string, enabled: boolean) {
    const m = await this.requireActiveMember(circleId, userId);
    const circle = await this.requireCircle(circleId);
    if (enabled && circle.contributionAmount === null) {
      throw new BadRequestException('Auto-contribute needs a fixed-step circle');
    }
    await this.prisma.circleMembership.update({ where: { id: m.id }, data: { autoContribute: enabled } });
    return { autoContribute: enabled };
  }

  /** Background runner: contribute the fixed step for everyone due. Skips the
   *  broke quietly (insufficient balance) — the countdown tells them instead. */
  async runAutoContributions(): Promise<number> {
    const due = await this.prisma.circleMembership.findMany({
      where: { status: 'active', autoContribute: true },
      include: { circle: true },
    });
    let paid = 0;
    for (const m of due) {
      if (m.circle.status !== 'active' || m.circle.contributionAmount === null) continue;
      const next = await this.nextContributionAt(m.circleId, m.userId);
      if (next !== null) continue;
      try {
        const { randomUUID } = await import('crypto');
        await this.contribute(m.circleId, m.userId, Number(m.circle.contributionAmount), randomUUID());
        paid++;
      } catch {
        continue; // usually insufficient balance; countdown + wallet say so
      }
    }
    return paid;
  }

  private countdown(at: number): string {
    const ms = Math.max(0, at - Date.now());
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.max(1, Math.floor((ms % 3600000) / 60000));
    return `${h}h ${m}m`;
  }
  async maybePayout(circleId: string, cycleId: string): Promise<void> {
    const cycle = await this.prisma.circleCycle.findUnique({ where: { id: cycleId } });
    if (!cycle || cycle.status !== 'collecting') return;
    const collected = await this.cycleCollected(circleId, cycleId);
    if (collected < Number(cycle.targetPot)) return;

    const claimed = await this.prisma.circleCycle.updateMany({
      where: { id: cycleId, status: 'collecting' },
      data: { status: 'payout_completed' },
    });
    if (claimed.count === 0) return; // another worker paid it first

    const wallet = await this.wallet.getWallet(cycle.recipientId);
    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: cycle.targetPot,
        type: 'circle_payout',
        relatedCircleId: circleId,
        relatedCycleId: cycleId,
        idempotencyKey: `payout:${cycleId}`,
      },
    }).catch(async (err: unknown) => {
      // Retried payout after a crash between claim and credit: already paid.
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') return null;
      throw err;
    });
    this.state.logTransition(circleId, 'collecting', 'payout_completed', `cycle_${cycle.cycleNumber}`);
    this.events.payoutCompleted(circleId, {
      cycleId,
      cycleNumber: cycle.cycleNumber,
      recipientId: cycle.recipientId,
      amount: Number(cycle.targetPot).toString(),
    });

    const next = await this.prisma.circleCycle.findFirst({
      where: { circleId, status: 'pending' },
      orderBy: { cycleNumber: 'asc' },
    });
    if (next) {
      const circle = await this.prisma.circle.findUniqueOrThrow({ where: { id: circleId } });
      const startsAt = new Date();
      await this.prisma.circleCycle.update({
        where: { id: next.id },
        data: { status: 'collecting', startsAt, endsAt: new Date(startsAt.getTime() + circle.cycleLengthDays * 86400000) },
      });
      this.events.cycleAdvanced(circleId, { cycleId: next.id, cycleNumber: next.cycleNumber, recipientId: next.recipientId });
    } else {
      const from = (await this.prisma.circle.findUniqueOrThrow({ where: { id: circleId } })).status;
      await this.prisma.circle.update({ where: { id: circleId }, data: { status: 'completed' } });
      this.state.logTransition(circleId, from, 'completed', 'rotation_complete');
      this.events.statusChanged(circleId, { from, to: 'completed' });
    }
  }

  async cycleCollected(circleId: string, cycleId: string): Promise<number> {
    const agg = await this.prisma.ledgerEntry.aggregate({
      where: { circleId, cycleId },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  private presentLedger(e: {
    id: string; circleId: string; userId: string;
    amount: { toString(): string }; type: 'contribution' | 'adjustment';
    idempotencyKey: string; createdAt: Date;
  }) {
    return {
      id: e.id, circleId: e.circleId, userId: e.userId,
      amount: e.amount.toString(), type: e.type,
      idempotencyKey: e.idempotencyKey, createdAt: e.createdAt,
    };
  }

  async close(circleId: string, userId: string) {
    const circle = await this.requireCircle(circleId);
    const mine = await this.prisma.circleMembership.findUnique({
      where: { circleId_userId: { circleId, userId } },
    });
    if (!mine || mine.role !== 'creator' || mine.status !== 'active') {
      throw new ForbiddenException('Only the creator can close a circle');
    }
    if (!this.state.canClose(circle.status)) {
      throw new BadRequestException(`Cannot close a circle in status ${circle.status}`);
    }
    const updated = await this.prisma.circle.update({
      where: { id: circleId },
      data: { status: 'closed' },
    });
    this.state.logTransition(circleId, circle.status, 'closed', 'creator_close');
    this.events.statusChanged(circleId, { from: circle.status, to: 'closed' });
    return { id: updated.id, status: updated.status };
  }

  async ledgerHistory(circleId: string, userId: string, page: number, limit: number) {
    await this.requireCircle(circleId);
    await this.requireMember(circleId, userId); // any membership incl. invited can audit
    return this.ledger.history(circleId, page, limit);
  }

  /** Used by the background job: transitions + a payout check. No-ops when idle. */
  async recompute(circleId: string): Promise<void> {
    await this.applyTransitions(circleId, 'scheduled_recompute');
    const current = await this.prisma.circleCycle.findFirst({
      where: { circleId, status: 'collecting' },
    });
    if (current) await this.maybePayout(circleId, current.id);
  }

  async openCircleIds(): Promise<string[]> {
    const rows = await this.prisma.circle.findMany({
      where: { status: { in: ['forming', 'active'] } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async summarize(circleId: string) {
    const circle = await this.prisma.circle.findUnique({
      where: { id: circleId },
      include: { _count: { select: { memberships: true } } },
    });
    if (!circle) throw new NotFoundException('Circle not found');
    const balance = await this.ledger.circleBalance(circleId);
    const goal = Number(circle.goalAmount);
    const activeMembers = await this.prisma.circleMembership.count({
      where: { circleId, status: 'active' },
    });
    return {
      id: circle.id,
      name: circle.name,
      goalAmount: goal,
      currency: circle.currency,
      status: circle.status,
      balance,
      progress: goal > 0 ? Math.min(1, balance / goal) : 0,
      memberCount: circle._count.memberships,
      activeMemberCount: activeMembers,
      createdAt: circle.createdAt,
    };
  }

  // Every automatic status change goes through here. close() is the only
  // other place that writes status. Rotation circles skip the legacy goal
  // transition; they complete through payouts, not balances.
  private async applyTransitions(circleId: string, reason: string) {
    const circle = await this.prisma.circle.findUnique({ where: { id: circleId } });
    if (!circle || circle.status === 'closed' || circle.status === 'completed' || circle.status === 'goal_reached') return;
    const [activeMemberCount, balance] = await Promise.all([
      this.prisma.circleMembership.count({ where: { circleId, status: 'active' } }),
      this.ledger.circleBalance(circleId),
    ]);
    const isRotation = circle.contributionAmount !== null;
    // Loop at most twice: forming→active→goal_reached can cascade on one contribution.
    let current: CircleStatus = circle.status;
    for (let i = 0; i < 2; i++) {
      const next = isRotation && current === 'active'
        ? null
        : this.state.nextStatus(
            { id: circleId, status: current, goalAmount: Number(circle.goalAmount), targetMembers: circle.targetMembers },
            activeMemberCount,
            balance,
          );
      if (!next) break;
      await this.prisma.circle.update({ where: { id: circleId }, data: { status: next } });
      this.state.logTransition(circleId, current, next, reason);
      this.events.statusChanged(circleId, { from: current, to: next });
      current = next;
      if (current === 'active' && isRotation) await this.lockRotation(circleId);
    }
  }

  /** Circle just went active: shuffle members into a locked payout order and
   *  open cycle 1. Fairness you can point at: the draw happens once, here. */
  private async lockRotation(circleId: string): Promise<void> {
    const existing = await this.prisma.circleCycle.count({ where: { circleId } });
    if (existing > 0) return;
    const circle = await this.prisma.circle.findUniqueOrThrow({ where: { id: circleId } });
    if (circle.contributionAmount === null) return;
    const members = await this.prisma.circleMembership.findMany({
      where: { circleId, status: 'active' },
      select: { userId: true },
    });
    const order = members.map((m) => m.userId);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const perCycle = Number(circle.contributionAmount) * 7 * order.length;
    await this.prisma.circle.update({ where: { id: circleId }, data: { rotationOrder: order } });
    const startsAt = new Date();
    for (let n = 0; n < order.length; n++) {
      await this.prisma.circleCycle.create({
        data: {
          circleId,
          cycleNumber: n + 1,
          recipientId: order[n],
          startsAt: n === 0 ? startsAt : new Date(0),
          endsAt: n === 0 ? new Date(startsAt.getTime() + circle.cycleLengthDays * 86400000) : new Date(0),
          targetPot: perCycle,
          status: n === 0 ? 'collecting' : 'pending',
        },
      });
    }
    this.state.logTransition(circleId, 'forming', 'active', `rotation_locked_${order.length}_cycles`);
  }

  private async requireCircle(circleId: string) {
    const circle = await this.prisma.circle.findUnique({ where: { id: circleId } });
    if (!circle) throw new NotFoundException('Circle not found');
    return circle;
  }

  private async requireMember(circleId: string, userId: string) {
    const m = await this.prisma.circleMembership.findUnique({
      where: { circleId_userId: { circleId, userId } },
    });
    if (!m) throw new ForbiddenException('You are not a member of this circle');
    return m;
  }

  private async requireActiveMember(circleId: string, userId: string) {
    const m = await this.requireMember(circleId, userId);
    if (m.status !== 'active') throw new ForbiddenException('Membership is not active');
    return m;
  }
}
