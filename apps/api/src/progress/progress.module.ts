import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CirclesModule } from '../circles/circles.module';
import { CirclesService } from '../circles/circles.service';

/**
 * Background progress job (spec §9): every N minutes recompute derived
 * progress for all open circles and flip active → goal_reached when the
 * ledger sum has crossed the goal. Contributions ALSO transition
 * synchronously, so the demo never waits on the cron — this job is the
 * safety net (and the "background processing" talking point).
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
        this.logger.error(JSON.stringify({ event: 'progress.recompute_error', circleId: id }));
      }
    }
    this.logger.log(JSON.stringify({ event: 'progress.recompute_done', circles: ids.length }));
  }
}

@Module({ imports: [CirclesModule], providers: [ProgressService] })
export class ProgressModule {}
