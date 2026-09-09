import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { protectedProcedure, router } from "@/server/api/trpc";
import { userSettings } from "@/server/db/schema";

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        weeklyTargetDays: userSettings.weeklyTargetDays,
        dailyRepGoal: userSettings.dailyRepGoal,
        dayStartOffsetMinutes: userSettings.dayStartOffsetMinutes,
        hapticsEnabled: userSettings.hapticsEnabled,
        onboardedAt: userSettings.onboardedAt,
        disclaimerAcceptedAt: userSettings.disclaimerAcceptedAt,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, ctx.userId));

    return {
      weeklyTargetDays: Math.min(7, Math.max(1, row?.weeklyTargetDays ?? 5)),
      dailyRepGoal: row?.dailyRepGoal ?? 50,
      dayStartOffsetMinutes: row?.dayStartOffsetMinutes ?? 0,
      hapticsEnabled: row?.hapticsEnabled ?? true,
      onboardedAt: row?.onboardedAt?.toISOString() ?? null,
      disclaimerAcceptedAt: row?.disclaimerAcceptedAt?.toISOString() ?? null,
    };
  }),

  update: protectedProcedure
    .input(
      z
        .object({
          weeklyTargetDays: z.number().int().min(1).max(7).optional(),
          dailyRepGoal: z.number().int().min(1).max(500).optional(),
          dayStartOffsetMinutes: z
            .union([
              z.literal(0),
              z.literal(60),
              z.literal(120),
              z.literal(180),
              z.literal(240),
            ])
            .optional(),
          hapticsEnabled: z.boolean().optional(),
        })
        .refine(
          (value) =>
            value.weeklyTargetDays !== undefined ||
            value.dailyRepGoal !== undefined ||
            value.dayStartOffsetMinutes !== undefined ||
            value.hapticsEnabled !== undefined,
          { message: "At least one setting is required." },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      await ctx.db
        .insert(userSettings)
        .values({
          userId: ctx.userId,
          weeklyTargetDays: input.weeklyTargetDays ?? 5,
          dailyRepGoal: input.dailyRepGoal ?? 50,
          dayStartOffsetMinutes: input.dayStartOffsetMinutes ?? 0,
          hapticsEnabled: input.hapticsEnabled ?? true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: {
            ...(input.weeklyTargetDays !== undefined
              ? { weeklyTargetDays: input.weeklyTargetDays }
              : {}),
            ...(input.dailyRepGoal !== undefined
              ? { dailyRepGoal: input.dailyRepGoal }
              : {}),
            ...(input.dayStartOffsetMinutes !== undefined
              ? { dayStartOffsetMinutes: input.dayStartOffsetMinutes }
              : {}),
            ...(input.hapticsEnabled !== undefined
              ? { hapticsEnabled: input.hapticsEnabled }
              : {}),
            updatedAt: now,
          },
        });

      return { ok: true };
    }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    await ctx.db
      .insert(userSettings)
      .values({
        userId: ctx.userId,
        onboardedAt: now,
        disclaimerAcceptedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          onboardedAt: now,
          disclaimerAcceptedAt: now,
          updatedAt: now,
        },
      });
    revalidatePath("/", "layout");
    revalidatePath("/onboarding");
    return { ok: true };
  }),
});
