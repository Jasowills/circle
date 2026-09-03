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
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { AuthService, GoogleProfile } from './auth.service';

class DevLoginDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

function refreshCookieOptions(): { httpOnly: boolean; secure: boolean; sameSite: 'lax' | 'none'; path: string; maxAge: number } {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd, // httpOnly + secure on web per spec; plain http locally
    // Deployed web (Static Web Apps) and API (App Service) are cross-origin:
    // fetch() will not attach a SameSite=Lax cookie, so prod needs None.
    sameSite: isProd ? 'none' : 'lax',
    path: '/auth',
    maxAge: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 24 * 3600 * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Step 1: redirect the user into Google. */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {
    // Passport handles the redirect.
  }

  /** Step 2: Google calls back here; we issue OUR JWT pair. */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response, @Query('format') format?: string) {
    const profile = req.user as GoogleProfile;
    if (!profile?.email || !profile?.googleId) {
      throw new UnauthorizedException('Google sign-in failed');
    }
    const { tokens } = await this.auth.loginWithGoogle(profile);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    // Mobile (Expo) can't easily read the redirect chain's cookies → allow ?format=json.
    if (format === 'json') {
      return res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    }
    const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:5173';
    return res.redirect(`${webAppUrl}/auth/callback?accessToken=${tokens.accessToken}`);
  }

  /** Dev-only login for local demo/tests without Google credentials. */
  @Post('dev-login')
  async devLogin(@Body() dto: DevLoginDto, @Res({ passthrough: true }) res: Response) {
    const { tokens } = await this.auth.devLogin(dto.email, dto.name);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  /** Mobile Google sign-in: verify the Expo-supplied ID token, issue our JWT pair. */
  @Post('google/id-token')
  async googleIdToken(@Body() body: { idToken?: string }, @Res({ passthrough: true }) res: Response) {
    if (!body?.idToken) throw new UnauthorizedException('Missing ID token');
    const { tokens } = await this.auth.loginWithIdToken(body.idToken);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  /** Rotate the refresh token (reads httpOnly cookie first, falls back to body for mobile). */
  @Post('refresh')
  async refresh(@Req() req: Request, @Body() body: { refreshToken?: string }, @Res({ passthrough: true }) res: Response) {
    const incoming: string | undefined = req.cookies?.refresh_token ?? body?.refreshToken;
    if (!incoming) throw new UnauthorizedException('Missing refresh token');
    const tokens = await this.auth.refresh(incoming);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  /** Invalidate the refresh token server-side (access token simply expires). */
  @Post('logout')
  async logout(@Req() req: Request, @Body() body: { refreshToken?: string }, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.refresh_token ?? body?.refreshToken);
    const { maxAge: _omit, ...clearOpts } = refreshCookieOptions();
    res.clearCookie('refresh_token', clearOpts);
    return { ok: true };
  }
}
