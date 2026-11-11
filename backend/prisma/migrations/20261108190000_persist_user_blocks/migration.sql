CREATE TABLE "user_blocks" (
    "blocker_id" TEXT NOT NULL,
    "blocked_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_user_id")
);

INSERT INTO "user_blocks" ("blocker_id", "blocked_user_id")
SELECT blocker."user_id", blocked_member."user_id"
FROM "conversation_members" AS blocker
JOIN "conversation_members" AS blocked_member
  ON blocked_member."conversation_id" = blocker."conversation_id"
JOIN "conversations" AS conversation
  ON conversation."id" = blocker."conversation_id"
WHERE blocker."is_blocked" = TRUE
  AND conversation."type" = 'direct'
  AND blocker."user_id" <> blocked_member."user_id"
ON CONFLICT ("blocker_id", "blocked_user_id") DO NOTHING;

ALTER TABLE "user_blocks"
ADD CONSTRAINT "user_blocks_blocker_id_fkey"
FOREIGN KEY ("blocker_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_blocks"
ADD CONSTRAINT "user_blocks_blocked_user_id_fkey"
FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
