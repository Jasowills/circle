import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { CircleEvents } from './circle-events';

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class CircleGateway implements OnGatewayInit {
  private readonly logger = new Logger('WSGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly events: CircleEvents,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.events.register((room, event, payload) => {
      this.server?.to(room).emit(event, payload);
    });
    this.logger.log(JSON.stringify({ event: 'ws.ready' }));
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { circleId?: string; token?: string },
  ) {
    try {
      const { circleId, token } = body ?? {};
      if (!circleId || !token) {
        client.emit('error', { message: 'join requires { circleId, token }' });
        return;
      }
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-min-32-chars-long',
      });
      const membership = await this.prisma.circleMembership.findUnique({
        where: { circleId_userId: { circleId, userId: payload.sub } },
      });
      if (!membership) {
        client.emit('error', { message: 'Not a member of this circle' });
        return;
      }
      await client.join(this.events.roomFor(circleId));
      client.emit('joined', { circleId });
      this.logger.log(JSON.stringify({ event: 'ws.join', circleId, userId: payload.sub }));
    } catch {
      client.emit('error', { message: 'Invalid token' });
    }
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { circleId?: string },
  ) {
    if (body?.circleId) await client.leave(this.events.roomFor(body.circleId));
  }
}
