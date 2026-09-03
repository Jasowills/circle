import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CirclesService } from './circles.service';
import { ContributeDto, CreateCircleDto, InviteDto } from './circles.dto';

@Controller('circles')
@UseGuards(JwtAuthGuard)
export class CirclesController {
  constructor(private readonly circles: CirclesService) {}

  @Post()
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateCircleDto) {
    return this.circles.create(req.user.id, dto.name, dto.goalAmount, dto.currency);
  }

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.circles.listForUser(req.user.id);
  }

  @Get(':id')
  detail(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.circles.detail(id, req.user.id);
  }

  @Post(':id/invite')
  invite(@Req() req: { user: { id: string } }, @Param('id') id: string, @Body() dto: InviteDto) {
    return this.circles.invite(id, req.user.id, dto.email);
  }

  // Action endpoints return 200 (not 201): they mutate state or replay it,
  // they don't always create a resource. create/invite keep the default 201.
  @Post(':id/accept')
  @HttpCode(200)
  accept(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.circles.accept(id, req.user.id);
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
