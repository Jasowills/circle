import { ConflictException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');
  private readonly accessTtl = process.env.JWT_ACCESS_TTL ?? '15m';
  private readonly refreshDays = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async loginWithGoogle(profile: GoogleProfile): Promise<{ userId: string; tokens: TokenPair; isNew: boolean }> {
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
    let isNew = false;
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {

        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: profile.googleId,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            googleId: profile.googleId,
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
          },
        });
        isNew = true;
      }
    }
    this.logger.log(
      JSON.stringify({ event: 'auth.login', userId: user.id, email: user.email }),
    );
    const tokens = await this.issueTokens(user.id);
    return { userId: user.id, tokens, isNew };
  }

  async loginWithIdToken(idToken: string): Promise<{ userId: string; tokens: TokenPair; isNew: boolean }> {

    const audiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
    ].filter((a): a is string => !!a);
    if (!audiences.length) {
      throw new ServiceUnavailableException('Google sign-in is not configured on the server');
    }
    let payload: { sub?: string; email?: string; name?: string; picture?: string };
    try {
      const ticket = await new OAuth2Client().verifyIdToken({ idToken, audience: audiences });
      payload = ticket.getPayload() ?? {};
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }
    if (!payload.sub || !payload.email) throw new UnauthorizedException('Invalid Google ID token');
    return this.loginWithGoogle({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? 'Circle member',
      avatarUrl: payload.picture,
    });
  }

  async devLogin(email: string, name?: string): Promise<{ userId: string; tokens: TokenPair; isNew: boolean }> {
    if (process.env.ALLOW_DEV_LOGIN !== 'true') {
      throw new UnauthorizedException('Dev login is disabled');
    }
    const normalized = email.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email: normalized } });
    let isNew = false;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          googleId: `dev:${normalized}`,
          email: normalized,
          name: name?.trim() || normalized.split('@')[0],
        },
      });
      isNew = true;
    }
    this.logger.log(JSON.stringify({ event: 'auth.dev_login', userId: user.id }));
    const tokens = await this.issueTokens(user.id);
    return { userId: user.id, tokens, isNew };
  }

  async signup(email: string, name: string, password: string): Promise<{ userId: string; tokens: TokenPair; isNew: boolean }> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) throw new ConflictException('An account with that email already exists');
    const user = await this.prisma.user.create({
      data: {
        googleId: `pwd:${normalized}`,
        email: normalized,
        name: name.trim(),
        passwordHash: await hash(password, 10),
      },
    });
    this.logger.log(JSON.stringify({ event: 'auth.signup', userId: user.id }));
    return { userId: user.id, tokens: await this.issueTokens(user.id), isNew: true };
  }

  async loginWithPassword(email: string, password: string): Promise<{ userId: string; tokens: TokenPair; isNew: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {

      throw new UnauthorizedException('Email or password is incorrect');
    }
    this.logger.log(JSON.stringify({ event: 'auth.login', userId: user.id }));
    return { userId: user.id, tokens: await this.issueTokens(user.id), isNew: false };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!stored) {
      this.logger.warn(JSON.stringify({ event: 'auth.refresh_rejected', reason: 'unknown_token' }));
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (stored.revokedAt || stored.expiresAt < new Date()) {
      this.logger.warn(JSON.stringify({
        event: 'auth.refresh_rejected',
        reason: stored.revokedAt ? 'revoked' : 'expired',
        userId: stored.userId,
      }));
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.userId);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log(JSON.stringify({ event: 'auth.logout' }));
  }

  private accessSecret(): string {
    return process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-min-32-chars-long';
  }

  private async issueTokens(userId: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      { secret: this.accessSecret(), expiresIn: this.accessTtl },
    );
    const refreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + this.refreshDays * 24 * 3600 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(refreshToken), expiresAt },
    });
    return { accessToken, refreshToken, expiresIn: 15 * 60 };
  }
}
