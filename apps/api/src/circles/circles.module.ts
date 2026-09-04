import { Module } from '@nestjs/common';
import { CirclesController } from './circles.controller';
import { CirclesService } from './circles.service';
import { CircleStateService } from './circle-state.service';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletModule } from '../wallet/wallet.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [LedgerModule, RealtimeModule, WalletModule],
  controllers: [CirclesController],
  providers: [CirclesService, CircleStateService],
  exports: [CirclesService, CircleStateService],
})
export class CirclesModule {}
