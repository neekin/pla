import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: string;
  source: string;
  payload: TPayload;
  createdAt: string;
}

type EventHandler = (event: DomainEvent) => void | Promise<void>;

@Injectable()
export class EventBusService {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly recentEvents: DomainEvent[] = [];
  private readonly maxRecent = 300;

  subscribe(eventType: string, handler: EventHandler) {
    const set = this.handlers.get(eventType) ?? new Set<EventHandler>();
    set.add(handler);
    this.handlers.set(eventType, set);

    return () => {
      const current = this.handlers.get(eventType);
      current?.delete(handler);
      if (current && current.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  async publish<TPayload extends Record<string, unknown> = Record<string, unknown>>(input: {
    type: string;
    source: string;
    payload: TPayload;
  }) {
    const event: DomainEvent<TPayload> = {
      id: randomUUID(),
      type: input.type,
      source: input.source,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    };

    this.recentEvents.unshift(event);
    if (this.recentEvents.length > this.maxRecent) {
      this.recentEvents.length = this.maxRecent;
    }

    const handlers = [
      ...(this.handlers.get('*') ?? []),
      ...(this.handlers.get(event.type) ?? []),
    ];

    for (const handler of handlers) {
      try {
        await handler(event as DomainEvent);
      } catch {
        // Keep event bus non-blocking for downstream failures.
      }
    }

    return event;
  }

  listRecent(limit = 100) {
    return this.recentEvents.slice(0, Math.max(1, limit));
  }
}
