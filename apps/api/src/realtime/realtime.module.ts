import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CircleEvents } from './circle-events';
import { CircleGateway } from './circle.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [CircleEvents, CircleGateway],
  exports: [CircleEvents],
})
export class RealtimeModule {}
