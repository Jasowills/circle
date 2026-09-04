import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DEMO_FUND_AMOUNT = 100000;

/**
 * One wallet per user. Balance is derived (SUM of transactions), same rule
 * as the circle ledger. The wallet is also append-only: money moves by
 * writing rows, never by editing a balance column (there isn't one).
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger('Wallet');

  constructor(private readonly prisma: PrismaService) {}

  /** Fetch the wallet, creating it with a demo top-up the first time. */
  async getWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      try {
        wallet = await this.prisma.wallet.create({ data: { userId } });
        await this.prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: DEMO_FUND_AMOUNT,
            type: 'demo_fund',
            idempotencyKey: 'initial-demo-fund',
          },
        });
        this.logger.log(JSON.stringify({ event: 'wallet.demo_funded', userId }));
      } catch (err: unknown) {
        // Lost a creation race: someone else made it first. Use theirs.
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
          wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
        } else throw err;
      }
    }
    return wallet;
  }

  async balance(walletId: string): Promise<number> {
    const agg = await this.prisma.walletTransaction.aggregate({
      where: { walletId },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  /** Demo top-up. Idempotent per key. Labeled demo: no real rail here. */
  async fund(userId: string, amount: number, idempotencyKey: string) {
    if (!Number.isFinite(amount) || amount < 100) {
      throw new BadRequestException('Top-up must be at least ₦100');
    }
    const wallet = await this.getWallet(userId);
    const key = idempotencyKey.trim();
    const existing = await this.prisma.walletTransaction.findUnique({
      where: { walletId_idempotencyKey: { walletId: wallet.id, idempotencyKey: key } },
    });
    if (existing) return { entry: this.present(existing), replayed: true };
    try {
      const created = await this.prisma.walletTransaction.create({
        data: { walletId: wallet.id, amount, type: 'fund', idempotencyKey: key },
      });
      this.logger.log(JSON.stringify({ event: 'wallet.funded', userId, amount }));
      return { entry: this.present(created), replayed: false };
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
        const winner = await this.prisma.walletTransaction.findUnique({
          where: { walletId_idempotencyKey: { walletId: wallet.id, idempotencyKey: key } },
        });
        if (winner) return { entry: this.present(winner), replayed: true };
      }
      throw err;
    }
  }

  async history(walletId: string, page: number, limit: number) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.walletTransaction.count({ where: { walletId } }),
      this.prisma.walletTransaction.findMany({
        where: { walletId },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);
    const balance = await this.balance(walletId);
    return {
      balance,
      data: rows.map((r) => this.present(r)),
      page: safePage,
      limit: safeLimit,
      total,
    };
  }

  private present(e: {
    id: string;
    walletId: string;
    amount: { toString(): string };
    type: string;
    relatedCircleId: string | null;
    relatedCycleId: string | null;
    idempotencyKey: string;
    createdAt: Date;
  }) {
    return {
      id: e.id,
      amount: e.amount.toString(),
      type: e.type,
      relatedCircleId: e.relatedCircleId,
      relatedCycleId: e.relatedCycleId,
      createdAt: e.createdAt,
    };
  }
}
