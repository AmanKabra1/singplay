/**
 * Runs the two pending schema changes that `db:push` prompts about interactively:
 *  1. Adds 'itunes' to the songs.source enum
 *  2. Adds the unique index on lyrics.song_id
 *
 * Safe to run multiple times — each statement is guarded against already-exists errors.
 */
import { connect } from "@tidbcloud/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = connect({ url });

async function run() {
  const stmts = [
    // Widen the enum to include 'itunes', 'archive', 'audius'.
    `ALTER TABLE songs MODIFY COLUMN source ENUM('local','jamendo','itunes','archive','audius') NOT NULL DEFAULT 'local'`,

    // Add unique index on lyrics.song_id.
    // TiDB doesn't support IF NOT EXISTS for ADD INDEX; duplicate-key error (1061) is caught below.
    `ALTER TABLE lyrics ADD UNIQUE INDEX lyrics_song_idx (song_id)`,

    // Language column — nullable, for tracking song's natural language (Hindi, Tamil, etc.).
    // MySQL error 1060 = Duplicate column name → already applied.
    `ALTER TABLE songs ADD COLUMN language VARCHAR(64) NULL AFTER license_note`,

    // Index for efficient language-based browsing.
    `ALTER TABLE songs ADD INDEX songs_language_idx (language)`,
  ];

  for (const sql of stmts) {
    try {
      await client.execute(sql);
      console.log("✓", sql.slice(0, 60) + "…");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // 1060 = Duplicate column name, 1061 = Duplicate key name → already applied
      if (msg.includes("1060") || msg.includes("1061") || msg.includes("already exists") || msg.includes("Duplicate column")) {
        console.log("— already applied:", sql.slice(0, 60) + "…");
      } else {
        throw err;
      }
    }
  }

  console.log("\nMigration complete.");
}

run().catch((err) => {
  console.error("\nMigration failed:", err);
  process.exit(1);
});
