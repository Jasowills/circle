import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WalletService } from './wallet.service';

class FundDto {
  @IsNumber()
  @Min(100)
  @Max(9999999999999999.99)
  @Type(() => Number)
  amount!: number;

  @IsUUID()
  idempotencyKey!: string;
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /** Balance + recent transactions. Touching this endpoint funds new wallets once. */
  @Get()
  async overview(@Req() req: { user: { id: string } }) {
    const w = await this.wallet.getWallet(req.user.id);
    return this.wallet.history(w.id, 1, 10);
  }

  @Get('transactions')
  async transactions(
    @Req() req: { user: { id: string } },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const w = await this.wallet.getWallet(req.user.id);
    return this.wallet.history(w.id, Number(page), Number(limit));
  }

  /** Demo-only instant credit. A real provider (Paystack etc.) plugs in here. */
  @Post('fund')
  async fund(@Req() req: { user: { id: string } }, @Body() dto: FundDto) {
    const result = await this.wallet.fund(req.user.id, dto.amount, dto.idempotencyKey);
    const w = await this.wallet.getWallet(req.user.id);
    return { ...result, balance: await this.wallet.balance(w.id) };
  }

  /** Demo withdrawal. Same idempotency discipline; never overdraws. */
  @Post('withdraw')
  async withdraw(@Req() req: { user: { id: string } }, @Body() dto: FundDto) {
    const result = await this.wallet.withdraw(req.user.id, dto.amount, dto.idempotencyKey);
    const w = await this.wallet.getWallet(req.user.id);
    return { ...result, balance: await this.wallet.balance(w.id) };
  }
}
