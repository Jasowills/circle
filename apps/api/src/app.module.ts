import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CirclesModule } from './circles/circles.module';
import { LedgerModule } from './ledger/ledger.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ProgressModule } from './progress/progress.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    CirclesModule,
    LedgerModule,
    RealtimeModule,
    ProgressModule,
  ],
})
export class AppModule {}
