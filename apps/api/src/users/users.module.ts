import { Controller, Get, Module, Req } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('me')
export class UsersController {
  @Get()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { id: string; email: string; name: string; avatarUrl: string | null; createdAt: Date } }) {
    const { id, email, name, avatarUrl, createdAt } = req.user;
    return { id, email, name, avatarUrl, createdAt };
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
