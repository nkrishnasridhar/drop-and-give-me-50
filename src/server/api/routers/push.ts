import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { DAILY_REMINDER } from "@/domain/reminder";
import { getVapidPublicKey, sendPushPayload } from "@/lib/push/send";
import { protectedProcedure, router } from "@/server/api/trpc";
import type { db as Database } from "@/server/db/client";
import { pushSubscriptions, userSettings } from "@/server/db/schema";

const subscriptionInput = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(256),
  auth: z.string().min(1).max(256),
  userAgent: z.string().max(500).optional(),
  tz: z.string().min(1).max(100).optional(),
});

async function persistTimeZone(
  db: typeof Database,
  userId: string,
  tz: string | undefined,
): Promise<void> {
  if (!tz) return;
  const now = new Date();
  await db
    .insert(userSettings)
    .values({ userId, tz, updatedAt: now })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { tz, updatedAt: now },
    });
}

export const pushRouter = router({
  publicKey: protectedProcedure.query(() => ({
    publicKey: getVapidPublicKey(),
  })),

  subscribe: protectedProcedure
    .input(subscriptionInput)
    .mutation(async ({ ctx, input }) => {
      if (!getVapidPublicKey()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Web Push is not configured on this server.",
        });
      }

      await persistTimeZone(ctx.db, ctx.userId, input.tz);

      await ctx.db
        .insert(pushSubscriptions)
        .values({
          userId: ctx.userId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent,
          failureCount: 0,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            userId: ctx.userId,
            p256dh: input.p256dh,
            auth: input.auth,
            userAgent: input.userAgent,
            failureCount: 0,
          },
          setWhere: eq(pushSubscriptions.userId, ctx.userId),
        });

      const [owned] = await ctx.db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.endpoint, input.endpoint),
            eq(pushSubscriptions.userId, ctx.userId),
          ),
        );

      if (!owned) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This push endpoint already belongs to a different user.",
        });
      }

      return { ok: true };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url().max(2048) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, ctx.userId),
            eq(pushSubscriptions.endpoint, input.endpoint),
          ),
        );
      return { ok: true };
    }),

  sendTest: protectedProcedure.mutation(async ({ ctx }) => {
    if (!getVapidPublicKey()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Web Push is not configured on this server.",
      });
    }

    const subs = await ctx.db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        failureCount: pushSubscriptions.failureCount,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, ctx.userId));

    if (subs.length === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No push subscription on this account yet.",
      });
    }

    const now = new Date();
    let sent = 0;
    for (const sub of subs) {
      const outcome = await sendPushPayload({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        payload: DAILY_REMINDER,
      });
      if (outcome === "sent") {
        sent += 1;
        await ctx.db
          .update(pushSubscriptions)
          .set({ lastSuccessAt: now, failureCount: 0 })
          .where(eq(pushSubscriptions.id, sub.id));
      } else if (outcome === "gone") {
        await ctx.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      } else {
        await ctx.db
          .update(pushSubscriptions)
          .set({ failureCount: sub.failureCount + 1 })
          .where(eq(pushSubscriptions.id, sub.id));
      }
    }

    if (sent === 0) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Could not deliver a test notification.",
      });
    }

    return { ok: true, sent };
  }),
});
