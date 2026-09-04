import { Body, Controller, Get, Module, Patch, Req } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class UpdateNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

@Controller('me')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { id: string; email: string; name: string; avatarUrl: string | null; createdAt: Date } }) {
    const { id, email, name, avatarUrl, createdAt } = req.user;
    return { id, email, name, avatarUrl, createdAt };
  }

  /** First-run profile completion (and later renames). */
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

@Module({ controllers: [UsersController] })
export class UsersModule {}
