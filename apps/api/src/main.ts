import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * Production refuses to boot on placeholder config. Dev stays frictionless:
 * empty Google creds fall back to 'missing-*' and dev-login covers local runs.
 */
function requireProdEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const access = process.env.JWT_ACCESS_SECRET ?? '';
  if (access.length < 32 || access.includes('change-me')) {
    throw new Error('JWT_ACCESS_SECRET must be a real secret (32+ chars) in production');
  }
  if (process.env.ALLOW_DEV_LOGIN === 'true') {
    throw new Error('ALLOW_DEV_LOGIN must not be true in production');
  }
  if (!process.env.WEB_APP_URL) {
    throw new Error('WEB_APP_URL must be set in production (CORS allow-list)');
  }
}

async function bootstrap() {
  requireProdEnv();
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  const isProd = process.env.NODE_ENV === 'production';
  const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:5173';
  app.enableCors({
    origin: isProd ? [webAppUrl] : [webAppUrl, 'http://localhost:5173', 'http://localhost:19006'],
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event: 'api.booted', port }));
}
bootstrap();
