import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LedgerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ContributionResult {
  entry: {
    id: string;
    circleId: string;
    userId: string;
    amount: string;
    type: LedgerType;
    idempotencyKey: string;
    createdAt: Date;
  };
  /** True when this request replayed an earlier key (no new row written). */
  replayed: boolean;
}

/**
 * The ONLY write path for LedgerEntry in the codebase.
 *
 * APPEND-ONLY: there is deliberately no update/delete method here, and no other
 * module touches prisma.ledgerEntry for writes. Corrections are new `adjustment`
 * rows (possibly negative), never edits.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger('LedgerWrite');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent contribution: (circleId, userId, idempotencyKey) is unique.
   * A retried/double-tapped request returns the ORIGINAL row with replayed=true.
   */
  async contribute(
    circleId: string,
    userId: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<ContributionResult> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }
    if (!idempotencyKey || idempotencyKey.trim().length < 8) {
      throw new BadRequestException('idempotencyKey (client-generated UUID) is required');
    }
    const key = idempotencyKey.trim();

    const existing = await this.prisma.ledgerEntry.findUnique({
      where: { circleId_userId_idempotencyKey: { circleId, userId, idempotencyKey: key } },
    });
    if (existing) {
      this.logger.log(
        JSON.stringify({ event: 'ledger.replayed', circleId, userId, entryId: existing.id }),
      );
      return { entry: this.present(existing), replayed: true };
    }

    try {
      const created = await this.prisma.ledgerEntry.create({
        data: { circleId, userId, amount, type: 'contribution', idempotencyKey: key },
      });
      this.logger.log(
        JSON.stringify({
          event: 'ledger.appended',
          circleId,
          userId,
          entryId: created.id,
          amount: created.amount.toString(),
        }),
      );
      return { entry: this.present(created), replayed: false };
    } catch (err: unknown) {
      // Race-safe: two concurrent first-attempts with the same key → unique
      // violation (P2002) → re-read and return the winner as a replay.
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
        const winner = await this.prisma.ledgerEntry.findUnique({
          where: { circleId_userId_idempotencyKey: { circleId, userId, idempotencyKey: key } },
        });
        if (winner) {
          this.logger.log(
            JSON.stringify({ event: 'ledger.replayed_race', circleId, userId, entryId: winner.id }),
          );
          return { entry: this.present(winner), replayed: true };
        }
      }
      throw err;
    }
  }

  /** Correction path: a NEW adjustment row (negative allowed), never an edit. */
  async adjust(circleId: string, userId: string, amount: number, idempotencyKey: string) {
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException('Adjustment amount must be a non-zero number');
    }
    return this.contributeAs(circleId, userId, amount, idempotencyKey.trim(), 'adjustment');
  }

  private async contributeAs(
    circleId: string,
    userId: string,
    amount: number,
    key: string,
    type: LedgerType,
  ): Promise<ContributionResult> {
    const existing = await this.prisma.ledgerEntry.findUnique({
      where: { circleId_userId_idempotencyKey: { circleId, userId, idempotencyKey: key } },
    });
    if (existing) return { entry: this.present(existing), replayed: true };
    const created = await this.prisma.ledgerEntry.create({
      data: { circleId, userId, amount, type, idempotencyKey: key },
    });
    this.logger.log(
      JSON.stringify({ event: 'ledger.appended', circleId, userId, entryId: created.id, type }),
    );
    return { entry: this.present(created), replayed: false };
  }

  /** Derived balance: SUM(amount) — never a stored mutable column. */
  async circleBalance(circleId: string): Promise<number> {
    const agg = await this.prisma.ledgerEntry.aggregate({
      where: { circleId },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  async memberBalance(circleId: string, userId: string): Promise<number> {
    const agg = await this.prisma.ledgerEntry.aggregate({
      where: { circleId, userId },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  async history(circleId: string, page: number, limit: number) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.count({ where: { circleId } }),
      this.prisma.ledgerEntry.findMany({
        where: { circleId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        circleId: r.circleId,
        userId: r.userId,
        user: r.user,
        amount: r.amount.toString(),
        type: r.type,
        createdAt: r.createdAt,
      })),
      page: safePage,
      limit: safeLimit,
      total,
    };
  }

  private present(e: {
    id: string;
    circleId: string;
    userId: string;
    amount: { toString(): string };
    type: LedgerType;
    idempotencyKey: string;
    createdAt: Date;
  }): ContributionResult['entry'] {
    return {
      id: e.id,
      circleId: e.circleId,
      userId: e.userId,
      amount: e.amount.toString(),
      type: e.type,
      idempotencyKey: e.idempotencyKey,
      createdAt: e.createdAt,
    };
  }
}
