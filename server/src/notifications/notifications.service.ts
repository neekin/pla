import { Injectable } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { Subject, interval, map, merge } from 'rxjs';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface PlatformNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  level: NotificationLevel;
  createdAt: string;
  meta?: Record<string, unknown>;
}

interface PublishNotificationInput {
  type: string;
  title: string;
  message: string;
  level?: NotificationLevel;
  meta?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly channel$ = new Subject<MessageEvent>();
  private readonly recent: PlatformNotification[] = [];
  private readonly maxRecent = 50;

  stream() {
    return merge(
      interval(25_000).pipe(
        map(() => ({
          type: 'ping',
          data: { timestamp: new Date().toISOString() },
        })),
      ),
      this.channel$.asObservable(),
    );
  }

  listRecent(limit = 20) {
    return this.recent.slice(0, Math.max(1, limit));
  }

  publish(input: PublishNotificationInput) {
    const payload: PlatformNotification = {
      id: `ntf_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      type: input.type,
      title: input.title,
      message: input.message,
      level: input.level ?? 'info',
      createdAt: new Date().toISOString(),
      meta: input.meta,
    };

    this.recent.unshift(payload);

    if (this.recent.length > this.maxRecent) {
      this.recent.length = this.maxRecent;
    }

    this.channel$.next({
      type: 'notification',
      data: payload,
    });

    return payload;
  }
}