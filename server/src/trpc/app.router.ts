import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

export const appRouter = t.router({
  hello: t.procedure
    .input(
      z
        .object({
          name: z.string().min(1).optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      const name = input?.name ?? 'tRPC';
      return {
        greeting: `你好，${name}！来自 NestJS + tRPC`,
      };
    }),
});

export type AppRouter = typeof appRouter;