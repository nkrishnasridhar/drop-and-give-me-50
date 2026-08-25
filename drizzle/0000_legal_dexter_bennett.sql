CREATE TABLE "account" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "daily_stat" (
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"total_reps" integer DEFAULT 0 NOT NULL,
	"set_count" integer DEFAULT 0 NOT NULL,
	"volume_load" numeric(8, 2) DEFAULT 0 NOT NULL,
	"first_at" timestamp with time zone,
	"last_at" timestamp with time zone,
	"top_variation_id" text,
	"is_rest_day" boolean DEFAULT false NOT NULL,
	CONSTRAINT "daily_stat_user_id_local_date_pk" PRIMARY KEY("user_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "push_set" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"variation_id" text NOT NULL,
	"reps" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"tz" text NOT NULL,
	"note" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "push_set_reps_range" CHECK ("push_set"."reps" between 1 and 500),
	CONSTRAINT "push_set_source_check" CHECK ("push_set"."source" in ('app', 'shortcut', 'backfill'))
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"last_success_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "rest_day" (
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rest_day_user_id_local_date_pk" PRIMARY KEY("user_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_setting" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"weekly_target_days" smallint DEFAULT 5 NOT NULL,
	"daily_rep_goal" integer DEFAULT 50 NOT NULL,
	"reminder_time" time,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"tz" text DEFAULT 'UTC' NOT NULL,
	"day_start_offset_minutes" integer DEFAULT 0 NOT NULL,
	"haptics_enabled" boolean DEFAULT true NOT NULL,
	"disclaimer_accepted_at" timestamp with time zone,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "variation" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"family" text NOT NULL,
	"intensity_factor" numeric(3, 2) NOT NULL,
	"difficulty" smallint NOT NULL,
	"primary_emphasis" text NOT NULL,
	CONSTRAINT "variation_family_check" CHECK ("variation"."family" in ('scapular', 'assisted', 'standard', 'tricep', 'wide', 'dynamic', 'shoulder', 'unilateral', 'advanced')),
	CONSTRAINT "variation_primary_emphasis_check" CHECK ("variation"."primary_emphasis" in ('chest', 'triceps', 'shoulders', 'serratus', 'core')),
	CONSTRAINT "variation_difficulty_range" CHECK ("variation"."difficulty" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stat" ADD CONSTRAINT "daily_stat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stat" ADD CONSTRAINT "daily_stat_top_variation_id_variation_id_fk" FOREIGN KEY ("top_variation_id") REFERENCES "public"."variation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_set" ADD CONSTRAINT "push_set_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_set" ADD CONSTRAINT "push_set_variation_id_variation_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."variation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rest_day" ADD CONSTRAINT "rest_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_setting" ADD CONSTRAINT "user_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_set_user_local_date_idx" ON "push_set" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "push_set_user_occurred_at_idx" ON "push_set" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "push_set_user_updated_at_idx" ON "push_set" USING btree ("user_id","updated_at");