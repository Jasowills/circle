import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService, GoogleProfile } from './auth.service';

class DevLoginDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class PasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

class SignupDto extends PasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

function refreshCookieOptions(): { httpOnly: boolean; secure: boolean; sameSite: 'lax' | 'none'; path: string; maxAge: number } {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd, // httpOnly + secure on web per spec; plain http locally

    sameSite: isProd ? 'none' : 'lax',
    path: '/auth',
    maxAge: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 24 * 3600 * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {
    // Passport handles the redirect.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response, @Query('format') format?: string) {
    const profile = req.user as GoogleProfile;
    if (!profile?.email || !profile?.googleId) {
      throw new UnauthorizedException('Google sign-in failed');
    }
    const { tokens, isNew } = await this.auth.loginWithGoogle(profile);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());

    if (format === 'json') {
      return res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isNew });
    }
    const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:5173';
    return res.redirect(`${webAppUrl}/auth/callback?accessToken=${tokens.accessToken}&isNew=${isNew ? '1' : '0'}`);
  }

  @Post('dev-login')
  async devLogin(@Body() dto: DevLoginDto, @Res({ passthrough: true }) res: Response) {
    const { tokens, isNew } = await this.auth.devLogin(dto.email, dto.name);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isNew };
  }

  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { tokens, isNew } = await this.auth.signup(dto.email, dto.name, dto.password);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isNew };
  }

  @Post('login')
  async login(@Body() dto: PasswordDto, @Res({ passthrough: true }) res: Response) {
    const { tokens, isNew } = await this.auth.loginWithPassword(dto.email, dto.password);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isNew };
  }

  @Post('google/id-token')
  async googleIdToken(@Body() body: { idToken?: string }, @Res({ passthrough: true }) res: Response) {
    if (!body?.idToken) throw new UnauthorizedException('Missing ID token');
    const { tokens, isNew } = await this.auth.loginWithIdToken(body.idToken);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isNew };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Body() body: { refreshToken?: string }, @Res({ passthrough: true }) res: Response) {
    const incoming: string | undefined = req.cookies?.refresh_token ?? body?.refreshToken;
    if (!incoming) throw new UnauthorizedException('Missing refresh token');
    const tokens = await this.auth.refresh(incoming);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Body() body: { refreshToken?: string }, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.refresh_token ?? body?.refreshToken);
    res.clearCookie('refresh_token', refreshCookieOptions());
    return { ok: true };
  }
}
