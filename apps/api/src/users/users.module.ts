import { Body, Controller, Get, Module, Param, Patch, Query, Req } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class UpdateNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

const publicSelect = { id: true, name: true, email: true, avatarUrl: true };

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.prisma.user.findMany({
      select: publicSelect,
      orderBy: { name: 'asc' },
      take: 50,
    });
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  search(@Query('q') q = '') {
    const query = q.trim();
    if (query.length < 2) return [];
    return this.prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: publicSelect,
      take: 10,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async profile(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: publicSelect });
    if (!user) throw new NotFoundException('User not found');
    const [mine, theirs] = await Promise.all([
      this.prisma.circleMembership.findMany({
        where: { userId: req.user.id },
        include: { circle: { select: { id: true, name: true, status: true } } },
      }),
      this.prisma.circleMembership.findMany({
        where: { userId: id },
        select: { circleId: true },
      }),
    ]);
    const theirIds = new Set(theirs.map((m) => m.circleId));
    return {
      user,
      isSelf: id === req.user.id,
      sharedCircles: mine.filter((m) => theirIds.has(m.circleId)).map((m) => m.circle),
      inviteTargets: mine
        .filter((m) => m.status === 'active' && !theirIds.has(m.circleId))
        .map((m) => m.circle),
    };
  }
}

@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { id: string; email: string; name: string; avatarUrl: string | null; createdAt: Date } }) {
    const { id, email, name, avatarUrl, createdAt } = req.user;
    return { id, email, name, avatarUrl, createdAt };
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  async updateMe(@Req() req: { user: { id: string } }, @Body() dto: UpdateNameDto) {
    const user = await this.prisma.user.update({
      where: { id: req.user.id },
      data: { name: dto.name.trim() },
    });
    const { id, email, name, avatarUrl, createdAt } = user;
    return { id, email, name, avatarUrl, createdAt };
  }
}

@Module({ controllers: [UsersController, MeController] })
export class UsersModule {}
