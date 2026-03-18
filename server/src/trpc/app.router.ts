import { TRPCError, initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';
import { TrpcContext } from './context';

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
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
  authProfile: protectedProcedure.query(({ ctx }) => ({
    user: ctx.user,
    platform: {
      mode: 'starter',
      message: '当前为开箱即用平台骨架，可逐步接入业务模块。',
    },
  })),
});

export type AppRouter = typeof appRouter;