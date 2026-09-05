import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CirclesService } from './circles.service';
import { ContributeDto, CreateCircleDto, InviteDto } from './circles.dto';

class AutoDto {
  @IsOptional()
  @IsBoolean()
  contribute?: boolean;

  @IsOptional()
  @IsBoolean()
  collect?: boolean;
}

class RotationDto {
  @IsIn(['random_draw', 'manual'])
  mode!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  order?: string[];
}

@Controller('circles')
@UseGuards(JwtAuthGuard)
export class CirclesController {
  constructor(private readonly circles: CirclesService) {}

  @Post()
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateCircleDto) {
    const hasRotation = dto.contributionAmount !== undefined || dto.targetMembers !== undefined;
    const goal = dto.goalAmount
      ?? (hasRotation && dto.contributionAmount && dto.targetMembers
        ? dto.contributionAmount * 7 * dto.targetMembers
        : undefined);
    if (goal === undefined) {
      throw new BadRequestException('Provide goalAmount, or contributionAmount + targetMembers for a rotation circle');
    }
    return this.circles.create(req.user.id, dto.name, goal, dto.currency, {
      contributionAmount: dto.contributionAmount,
      targetMembers: dto.targetMembers,
      cycleLengthDays: dto.cycleLengthDays,
      contributionsPerWeek: dto.contributionsPerWeek,
    });
  }

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.circles.listForUser(req.user.id);
  }

  @Get('discover')
  discover(@Req() req: { user: { id: string } }, @Query('q') q?: string) {
    return this.circles.discover(req.user.id, q);
  }

  @Get(':id')
  detail(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.circles.detail(id, req.user.id);
  }

  @Get(':id/cycles')
  cycles(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.circles.cycles(id, req.user.id);
  }

  @Post(':id/invite')
  invite(@Req() req: { user: { id: string } }, @Param('id') id: string, @Body() dto: InviteDto) {
    return this.circles.invite(id, req.user.id, dto);
  }

  // Action endpoints return 200 (not 201): they mutate state or replay it,
  // they don't always create a resource. create/invite keep the default 201.
  @Post(':id/accept')
  @HttpCode(200)
  accept(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.circles.accept(id, req.user.id);
  }

  @Post(':id/activate')
  @HttpCode(200)
  activate(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.circles.activate(id, req.user.id);
  }

  @Post(':id/join')
  @HttpCode(200)
  join(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.circles.join(id, req.user.id);
  }

  /** Autopilot switches (auto-contribute, auto-collect) for my membership. */
  @Patch(':id/auto')
  auto(@Req() req: { user: { id: string } }, @Param('id') id: string, @Body() dto: AutoDto) {
    return this.circles.setAuto(id, req.user.id, dto);
  }

  /** Creator sets the draw mode + manual order while the circle is forming. */
  @Patch(':id/rotation')
  rotation(@Req() req: { user: { id: string } }, @Param('id') id: string, @Body() dto: RotationDto) {
    return this.circles.setRotation(id, req.user.id, dto.mode, dto.order ?? []);
  }

  /** Collect a won pot that waited for a manual tap. */
  @Post(':id/cycles/:cycleId/claim')
  @HttpCode(200)
  claim(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.circles.claimCycle(id, cycleId, req.user.id);
  }

  @Post(':id/contribute')
  @HttpCode(200)
  contribute(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: ContributeDto,
  ) {
    return this.circles.contribute(id, req.user.id, dto.amount, dto.idempotencyKey);
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.circles.close(id, req.user.id);
  }

  @Get(':id/ledger')
  ledger(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.circles.ledgerHistory(id, req.user.id, Number(page), Number(limit));
  }
}
