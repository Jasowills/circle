import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CircleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CircleStateService } from './circle-state.service';
import { CircleEvents } from '../realtime/circle-events';

@Injectable()
export class CirclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly state: CircleStateService,
    private readonly events: CircleEvents,
  ) {}

  async create(creatorId: string, name: string, goalAmount: number, currency?: string) {
    const circle = await this.prisma.circle.create({
      data: {
        name: name.trim(),
        goalAmount,
        currency: (currency ?? 'NGN').toUpperCase(),
        createdById: creatorId,
        memberships: {
          create: { userId: creatorId, role: 'creator', status: 'active', joinedAt: new Date() },
        },
      },
      include: { memberships: true },
    });
    return this.detail(circle.id, creatorId);
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.circleMembership.findMany({
      where: { userId },
      include: { circle: true },
      orderBy: { invitedAt: 'desc' },
    });
    return Promise.all(
      memberships.map(async (m) => this.summarize(m.circle.id, m.status as string)),
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
      myMembership: { role: mine.role, status: mine.status },
      myBalance: await this.ledger.memberBalance(circleId, viewerId),
      members,
    };
  }

  async invite(circleId: string, inviterId: string, email: string) {
    const circle = await this.requireCircle(circleId);
    await this.requireActiveMember(circleId, inviterId);
    if (circle.status === 'closed') throw new BadRequestException('Circle is closed');

    const invitee = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!invitee) {
      throw new NotFoundException('No account with that email yet — they must sign in once first');
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

  async contribute(circleId: string, userId: string, amount: number, idempotencyKey: string) {
    const circle = await this.requireCircle(circleId);
    if (circle.status === 'closed') throw new BadRequestException('Circle is closed');
    await this.requireActiveMember(circleId, userId);

    const result = await this.ledger.contribute(circleId, userId, amount, idempotencyKey);
    if (!result.replayed) {
      this.events.contributionCreated(circleId, {
        entryId: result.entry.id,
        userId,
        amount: result.entry.amount,
      });
      await this.applyTransitions(circleId, 'contribution');
    }
    return { ...result, circle: await this.summarize(circleId) };
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

  /** Used by the background job: recompute + transition without emitting duplicates. */
  async recompute(circleId: string): Promise<void> {
    await this.applyTransitions(circleId, 'scheduled_recompute');
  }

  async openCircleIds(): Promise<string[]> {
    const rows = await this.prisma.circle.findMany({
      where: { status: { in: ['forming', 'active'] } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  // ---- internals ----

  private async summarize(circleId: string, viewerStatus?: string) {
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
      myStatus: viewerStatus,
      createdAt: circle.createdAt,
    };
  }

  /** Central transition runner — the ONLY place status writes happen (besides close). */
  private async applyTransitions(circleId: string, reason: string) {
    const circle = await this.prisma.circle.findUnique({ where: { id: circleId } });
    if (!circle || circle.status === 'closed' || circle.status === 'goal_reached') return;
    const [activeMemberCount, balance] = await Promise.all([
      this.prisma.circleMembership.count({ where: { circleId, status: 'active' } }),
      this.ledger.circleBalance(circleId),
    ]);
    // Loop at most twice: forming→active→goal_reached can cascade on one contribution.
    let current: CircleStatus = circle.status;
    for (let i = 0; i < 2; i++) {
      const next = this.state.nextStatus(
        { id: circleId, status: current, goalAmount: Number(circle.goalAmount) },
        activeMemberCount,
        balance,
      );
      if (!next) break;
      await this.prisma.circle.update({ where: { id: circleId }, data: { status: next } });
      this.state.logTransition(circleId, current, next, reason);
      this.events.statusChanged(circleId, { from: current, to: next });
      current = next;
    }
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
