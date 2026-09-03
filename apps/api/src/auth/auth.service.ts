import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
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

  /** Find-or-create a user from a verified Google profile, then issue our own JWT pair. */
  async loginWithGoogle(profile: GoogleProfile): Promise<{ userId: string; tokens: TokenPair }> {
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        // Same person, new Google link. Attach it instead of duplicating.
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
      }
    }
    this.logger.log(
      JSON.stringify({ event: 'auth.login', userId: user.id, email: user.email }),
    );
    const tokens = await this.issueTokens(user.id);
    return { userId: user.id, tokens };
  }

  /**
   * Mobile sign-in. The app completes Google natively and hands us the ID
   * token; we check the signature and audience here, then issue our own pair.
   */
  async loginWithIdToken(idToken: string): Promise<{ userId: string; tokens: TokenPair }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured on the server');
    }
    let payload: { sub?: string; email?: string; name?: string; picture?: string };
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({
        idToken,
        audience: clientId,
      });
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

  /** Dev-only login (ALLOW_DEV_LOGIN=true): no Google round-trip, for local demo/tests. */
  async devLogin(email: string, name?: string): Promise<{ userId: string; tokens: TokenPair }> {
    if (process.env.ALLOW_DEV_LOGIN !== 'true') {
      throw new UnauthorizedException('Dev login is disabled');
    }
    const normalized = email.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          googleId: `dev:${normalized}`,
          email: normalized,
          name: name?.trim() || normalized.split('@')[0],
        },
      });
    }
    this.logger.log(JSON.stringify({ event: 'auth.dev_login', userId: user.id }));
    const tokens = await this.issueTokens(user.id);
    return { userId: user.id, tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    // Rotate: revoke the used token, issue a fresh pair (limits replay window).
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
    const refreshToken = randomBytes(48).toString('hex'); // opaque, hashed at rest
    const expiresAt = new Date(Date.now() + this.refreshDays * 24 * 3600 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(refreshToken), expiresAt },
    });
    return { accessToken, refreshToken, expiresIn: 15 * 60 };
  }
}
