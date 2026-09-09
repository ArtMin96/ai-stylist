CREATE TABLE "platform_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"aggregate_kind" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"sequence" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_outbox_aggregate_sequence_uq" ON "platform_outbox" USING btree ("aggregate_kind","aggregate_id","sequence");--> statement-breakpoint
CREATE INDEX "platform_outbox_pending_idx" ON "platform_outbox" USING btree ("status","next_attempt_at") WHERE "platform_outbox"."status" <> 'dispatched';