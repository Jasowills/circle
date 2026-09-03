import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CirclesModule } from '../circles/circles.module';
import { CirclesService } from '../circles/circles.service';

/**
 * Every couple of minutes, re-check open circles for transitions the
 * write path may have missed. Contributions already transition
 * synchronously, so this is a backstop, not the main mechanism.
 */
@Injectable()
export class ProgressService {
  private readonly logger = new Logger('ProgressJob');

  constructor(private readonly circles: CirclesService) {}

  @Cron(process.env.PROGRESS_CRON ?? '*/2 * * * *')
  async recomputeAll() {
    const ids = await this.circles.openCircleIds();
    this.logger.log(JSON.stringify({ event: 'progress.recompute_start', circles: ids.length }));
    for (const id of ids) {
      try {
        await this.circles.recompute(id);
      } catch (err) {
        this.logger.error(
          JSON.stringify({ event: 'progress.recompute_error', circleId: id, error: String(err) }),
        );
      }
    }
    this.logger.log(JSON.stringify({ event: 'progress.recompute_done', circles: ids.length }));
  }
}

@Module({ imports: [CirclesModule], providers: [ProgressService] })
export class ProgressModule {}
