import { db } from "../src/db.js";
import { catalogSeedScenarios } from "./catalogSeed.js";
import { referenceBySlug, rubricsByTaskType, defectsBySlug } from "./reviewSeed.js";

export async function seedCatalog(): Promise<void> {
  for (const scenario of catalogSeedScenarios) {
    const referenceSolution = referenceBySlug[scenario.slug];
    const rubric = rubricsByTaskType[scenario.taskType];
    const embeddedDefects = defectsBySlug[scenario.slug] ?? [];
    if (!referenceSolution || !rubric) {
      throw new Error(`Missing rubric or reference solution for ${scenario.slug}.`);
    }
    await db.scenario.upsert({
      where: { slug: scenario.slug },
      create: { ...scenario, status: "published", referenceSolution, rubric, embeddedDefects },
      update: {
        title: scenario.title,
        summary: scenario.summary,
        taskType: scenario.taskType,
        mode: scenario.mode,
        difficulty: scenario.difficulty,
        prompt: scenario.prompt,
        passingThreshold: scenario.passingThreshold,
        status: "published",
        referenceSolution,
        rubric,
        embeddedDefects,
      },
    });
  }
}

const invokedDirectly = process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/seedCatalog.ts");

if (invokedDirectly) {
  seedCatalog()
    .then(async () => {
      console.log(`Catalog seeded (${catalogSeedScenarios.length} scenarios).`);
      await db.$disconnect();
      process.exit(0);
    })
    .catch(async (err: unknown) => {
      console.error("Unexpected error during catalog seeding:", err);
      await db.$disconnect();
      process.exit(1);
    });
}
