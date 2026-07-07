// Seed sample FS-004 Prepare content for pregnancy 1: a supporter membership (so
// reassignment can be exercised), a block of system tasks across the three task
// types, and one sample Shared Decision with contributions. Idempotent — tasks and
// decisions are only seeded when the pregnancy has none yet; the supporter person
// upserts on phone.
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const PREGNANCY_ID = 1;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// taskType: mine_only | assigned | together
const tasks = [
  {
    title: "Choose a prenatal provider",
    taskType: "mine_only",
    dueWeek: 10,
    whyNow: "Getting established early means your first scans and screenings land on time.",
    whyItMatters: "A provider you trust sets the tone for everything that follows.",
    checklist: [
      { label: "List a few options nearby", done: true },
      { label: "Check what your insurance covers", done: false },
      { label: "Book a first appointment", done: false },
    ],
    prompts: "Ask a candidate: how do you handle after-hours questions?",
    assignTo: "pregnant",
  },
  {
    title: "Start a shared calendar for appointments",
    taskType: "together",
    dueWeek: 11,
    whyNow: "Appointments start clustering soon — a shared view keeps everyone in the loop.",
    whyItMatters: "No one has to be the sole keeper of the schedule.",
    checklist: [
      { label: "Pick a calendar you both use", done: false },
      { label: "Add the next appointment", done: false },
    ],
    assignTo: null,
  },
  {
    title: "Talk through who to tell, and when",
    taskType: "together",
    dueWeek: 12,
    whyNow: "The end of the first trimester is a common moment to share the news.",
    whyItMatters: "Agreeing on the plan together avoids surprises later.",
    checklist: null,
    prompts: "There's no right timeline — only the one that feels right to you both.",
    assignTo: null,
  },
  {
    title: "Look into parental leave options",
    taskType: "assigned",
    dueWeek: 13,
    whyNow: "Employers often need notice, and the paperwork can take a while.",
    whyItMatters: "Knowing your options early gives you room to plan finances.",
    checklist: [
      { label: "Find your employer's policy", done: false },
      { label: "Note any deadlines", done: false },
    ],
    assignTo: "supporter",
  },
];

// One sample Shared Decision (default Public), with two contributions, left Open.
const decision = {
  title: "Where should we have the baby?",
  prompt: "Hospital, birth center, or home — what feels right for us?",
  contributions: [
    { author: "pregnant", body: "I lean toward the hospital nearest us for the peace of mind." },
    { author: "supporter", body: "Agreed on hospital. Let's tour the birth center too before we lock it in." },
  ],
};

async function main() {
  const client = await pool.connect();
  try {
    // Ensure a supporter membership exists for reassignment testing.
    const supPhone = "+15550000002";
    const existingPerson = await client.query(`SELECT id FROM persons WHERE phone=$1`, [supPhone]);
    let supporterPersonId;
    if (existingPerson.rows.length > 0) {
      supporterPersonId = existingPerson.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO persons (display_name, phone) VALUES ($1,$2) RETURNING id`,
        ["Sam", supPhone],
      );
      supporterPersonId = ins.rows[0].id;
    }

    let supMembership = await client.query(
      `SELECT id FROM memberships WHERE pregnancy_id=$1 AND person_id=$2`,
      [PREGNANCY_ID, supporterPersonId],
    );
    let supporterMembershipId;
    if (supMembership.rows.length > 0) {
      supporterMembershipId = supMembership.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO memberships (person_id, pregnancy_id, role, invitation_status)
         VALUES ($1,$2,'supporter','active') RETURNING id`,
        [supporterPersonId, PREGNANCY_ID],
      );
      supporterMembershipId = ins.rows[0].id;
    }

    const pp = await client.query(
      `SELECT id FROM memberships WHERE pregnancy_id=$1 AND role='pregnant_person' LIMIT 1`,
      [PREGNANCY_ID],
    );
    const pregnantMembershipId = pp.rows[0]?.id ?? null;

    const resolveAssignee = (a) =>
      a === "pregnant" ? pregnantMembershipId : a === "supporter" ? supporterMembershipId : null;

    const { rows: taskCount } = await client.query(
      `SELECT count(*)::int AS n FROM tasks WHERE pregnancy_id=$1`,
      [PREGNANCY_ID],
    );
    if (taskCount[0].n === 0) {
      let sort = 0;
      for (const t of tasks) {
        await client.query(
          `INSERT INTO tasks
             (pregnancy_id, title, why_now, why_it_matters, checklist, prompts,
              task_type, status, assigned_member_id, due_week, is_user_added, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'not_started',$8,$9,false,$10)`,
          [
            PREGNANCY_ID,
            t.title,
            t.whyNow ?? null,
            t.whyItMatters ?? null,
            t.checklist ? JSON.stringify(t.checklist.map((c, i) => ({ id: `c${i}`, ...c }))) : null,
            t.prompts ?? null,
            t.taskType,
            resolveAssignee(t.assignTo),
            t.dueWeek ?? null,
            sort++,
          ],
        );
      }
      console.log(`Seeded ${tasks.length} system tasks for pregnancy ${PREGNANCY_ID}.`);
    } else {
      console.log(`Pregnancy ${PREGNANCY_ID} already has ${taskCount[0].n} tasks — skipping task seed.`);
    }

    const { rows: decCount } = await client.query(
      `SELECT count(*)::int AS n FROM shared_decisions WHERE pregnancy_id=$1`,
      [PREGNANCY_ID],
    );
    if (decCount[0].n === 0 && pregnantMembershipId) {
      const dec = await client.query(
        `INSERT INTO shared_decisions
           (pregnancy_id, title, prompt, status, visibility, created_by_membership_id)
         VALUES ($1,$2,$3,'open','public',$4) RETURNING id`,
        [PREGNANCY_ID, decision.title, decision.prompt, pregnantMembershipId],
      );
      const decisionId = dec.rows[0].id;
      for (const c of decision.contributions) {
        const author = c.author === "pregnant" ? pregnantMembershipId : supporterMembershipId;
        await client.query(
          `INSERT INTO decision_contributions (shared_decision_id, author_membership_id, body)
           VALUES ($1,$2,$3)`,
          [decisionId, author, c.body],
        );
      }
      console.log(`Seeded 1 shared decision with ${decision.contributions.length} contributions.`);
    } else {
      console.log(`Pregnancy ${PREGNANCY_ID} already has ${decCount[0].n} decisions — skipping decision seed.`);
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
