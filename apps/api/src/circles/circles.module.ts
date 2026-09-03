import { Module } from '@nestjs/common';
import { CirclesController } from './circles.controller';
import { CirclesService } from './circles.service';
import { CircleStateService } from './circle-state.service';
import { LedgerModule } from '../ledger/ledger.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [LedgerModule, RealtimeModule],
  controllers: [CirclesController],
  providers: [CirclesService, CircleStateService],
  exports: [CirclesService, CircleStateService],
})
export class CirclesModule {}
