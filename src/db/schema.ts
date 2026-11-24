import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type Category = "practical" | "humorous";

export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  // 1 (everyday) .. 6 (rarefied). Set by the placement quiz.
  level: integer("level").notNull().default(3),
  placementDone: boolean("placement_done").notNull().default(false),
  // Placement words the user missed — prime candidates for future daily words.
  placementMissed: jsonb("placement_missed").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const words = pgTable(
  "words",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    word: text("word").notNull(),
    phonetic: text("phonetic"),
    audioUrl: text("audio_url"),
    partOfSpeech: text("part_of_speech"),
    definition: text("definition").notNull(),
    dictionaryDefinition: text("dictionary_definition"),
    example: text("example"),
    category: text("category").$type<Category>().notNull().default("practical"),
    domain: text("domain"),
    source: text("source").$type<"daily" | "manual">().notNull(),
    why: text("why"),
    notes: text("notes"),
    // Spaced repetition state (simplified SM-2).
    ease: real("ease").notNull().default(2.5),
    intervalDays: real("interval_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    incorrectCount: integer("incorrect_count").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("words_user_word_idx").on(t.userId, sql`lower(${t.word})`),
    index("words_user_due_idx").on(t.userId, t.dueAt),
  ],
);

export const dailyWords = pgTable(
  "daily_words",
  {
    userId: text("user_id").notNull(),
    // The user's local calendar date, YYYY-MM-DD.
    date: text("date").notNull(),
    wordId: integer("word_id").references(() => words.id, { onDelete: "set null" }),
    status: text("status").$type<"pending" | "ready" | "failed">().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

// Daily words the user passed on, kept so they're never suggested again.
export const skippedWords = pgTable(
  "skipped_words",
  {
    userId: text("user_id").notNull(),
    // Lowercase.
    word: text("word").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.word] })],
);

// Every AI call is logged so we can enforce a hard cap and see real spend.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_user_created_idx").on(t.userId, t.createdAt)],
);

export type Word = typeof words.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
