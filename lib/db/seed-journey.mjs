// Seed sample FS-003 Journey content: a contiguous block of JourneyWeeks plus a
// pool of journal prompts. Idempotent — weeks upsert on week_number; prompts are
// only seeded when the pool is empty (they're referenced by memories via FK).
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// weekNumber -> content. Shared fields are role-neutral; the two variants carry
// the role-aware framing (ADR-002: role drives content, not re-skinned copy).
const weeks = [
  {
    w: 10,
    baby: "Your baby is about the size of a strawberry — tiny fingernails and downy hair are beginning to form.",
    milestones: "Vital organs are now in place and starting to function.",
    common: "Early symptoms like fatigue and nausea are often at their peak around now.",
    pp: "You might feel wiped out — your body is doing enormous, invisible work. Rest is productive right now.",
    sup: "Small gestures land big this week: take something off their plate before they have to ask.",
    isCommon: "Feeling exhausted this early is extremely common and not a sign anything is wrong.",
  },
  {
    w: 11,
    baby: "Your baby is about the size of a fig and is starting to move, though you won't feel it yet.",
    milestones: "Tooth buds and tiny bones are beginning to develop.",
    common: "Some people notice food aversions shifting from week to week.",
    pp: "Cravings and aversions can feel random — there's no wrong way to eat through this stretch.",
    sup: "Stock a few 'safe' snacks you know they can keep down. It's a quiet way to help.",
    isCommon: "Sudden food aversions are a normal part of early pregnancy for many people.",
  },
  {
    w: 12,
    baby: "Your baby is about the size of a lime — reflexes are developing and fingers may soon open and close.",
    milestones: "The end of the first trimester is in sight.",
    common: "Many people find early symptoms begin to ease over the coming weeks.",
    pp: "You're nearing the end of the first trimester — a milestone worth marking however feels right to you.",
    sup: "This is a good week to check in on how they're feeling about sharing the news, if you haven't.",
    isCommon: "Relief mixed with lingering anxiety is a very common way to feel at this milestone.",
  },
  {
    w: 13,
    baby: "Your baby is about the size of a pea pod and has begun to form tiny, unique fingerprints.",
    milestones: "Welcome to the second trimester.",
    common: "Energy often starts to return as the first trimester winds down.",
    pp: "The second trimester often brings a bit more energy back — go gently as you find your footing.",
    sup: "If they've been running on empty, this can be a turning point. Celebrate the small wins together.",
    isCommon: "An energy rebound in the second trimester is common, though not everyone feels it right away.",
  },
  {
    w: 14,
    baby: "Your baby is about the size of a lemon and can now make facial expressions.",
    milestones: "The body is starting to show for many people.",
    common: "Some notice a first hint of a bump around this time.",
    pp: "A first bump can bring a wave of feelings — however you feel about it is completely valid.",
    sup: "If a bump is showing, follow their lead on how much attention they want on it.",
    isCommon: "Showing early or late varies enormously between people and pregnancies.",
  },
];

// role_target: pregnant_person | supporter | both. Week ranges keep prompts
// eligible across a span; pregnancy_number_target stays 'any' for the MVP seed.
const prompts = [
  { text: "What's one thing that surprised you about this week?", role: "both", start: 8, end: 20 },
  { text: "Write a short note to your baby about today.", role: "both", start: 8, end: 42 },
  { text: "How is your body feeling right now, honestly?", role: "pregnant_person", start: 8, end: 42 },
  { text: "What's one way you supported your partner this week?", role: "supporter", start: 8, end: 42 },
  { text: "What are you most looking forward to about meeting your baby?", role: "both", start: 8, end: 42 },
  { text: "Describe a moment this week that made this feel real.", role: "both", start: 10, end: 24 },
  { text: "What's a worry you'd like to set down for now?", role: "both", start: 8, end: 42 },
  { text: "What kind of parent do you hope to be?", role: "both", start: 8, end: 42 },
  { text: "What's changed about how you see your partner lately?", role: "supporter", start: 10, end: 42 },
  { text: "What do you need more of this week — rest, help, or space?", role: "pregnant_person", start: 8, end: 42 },
];

async function main() {
  const client = await pool.connect();
  try {
    for (const wk of weeks) {
      await client.query(
        `INSERT INTO journey_weeks
           (week_number, shared_baby_development, shared_milestones,
            pregnant_person_variant, supporter_variant, common_experiences, is_this_common_content)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (week_number) DO UPDATE SET
           shared_baby_development = EXCLUDED.shared_baby_development,
           shared_milestones = EXCLUDED.shared_milestones,
           pregnant_person_variant = EXCLUDED.pregnant_person_variant,
           supporter_variant = EXCLUDED.supporter_variant,
           common_experiences = EXCLUDED.common_experiences,
           is_this_common_content = EXCLUDED.is_this_common_content,
           updated_at = now()`,
        [wk.w, wk.baby, wk.milestones, wk.pp, wk.sup, wk.common, wk.isCommon],
      );
    }
    console.log(`Upserted ${weeks.length} journey weeks (${weeks[0].w}-${weeks[weeks.length - 1].w}).`);

    const { rows } = await client.query(`SELECT count(*)::int AS n FROM memory_prompts`);
    if (rows[0].n === 0) {
      for (const p of prompts) {
        await client.query(
          `INSERT INTO memory_prompts
             (prompt_text, role_target, eligible_start_week, eligible_end_week, pregnancy_number_target)
           VALUES ($1,$2,$3,$4,'any')`,
          [p.text, p.role, p.start, p.end],
        );
      }
      console.log(`Seeded ${prompts.length} memory prompts.`);
    } else {
      console.log(`memory_prompts already has ${rows[0].n} rows — skipping prompt seed.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
