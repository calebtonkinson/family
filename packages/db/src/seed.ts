import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { households, familyMembers, users, themes, projects, tasks } from "./schema/index.js";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  console.log("Seeding database...");

  // Create household
  const [household] = await db
    .insert(households)
    .values({
      name: "Tonkinson Family",
    })
    .returning();

  if (!household) throw new Error("Failed to create household");
  console.log("Created household:", household.id);

  // Create family members
  const [caleb] = await db
    .insert(familyMembers)
    .values({
      householdId: household.id,
      firstName: "Caleb",
      lastName: "Tonkinson",
      gender: "male",
    })
    .returning();

  if (!caleb) throw new Error("Failed to create caleb");

  const [hillary] = await db
    .insert(familyMembers)
    .values({
      householdId: household.id,
      firstName: "Hillary",
      lastName: "Tonkinson",
      gender: "female",
    })
    .returning();

  if (!hillary) throw new Error("Failed to create hillary");
  console.log("Created family members:", caleb.id, hillary.id);

  // Create users
  const [calebUser] = await db
    .insert(users)
    .values({
      householdId: household.id,
      familyMemberId: caleb.id,
      email: "calebtonkinson@gmail.com",
      name: "Caleb Tonkinson",
    })
    .returning();

  if (!calebUser) throw new Error("Failed to create calebUser");

  const [hillaryUser] = await db
    .insert(users)
    .values({
      householdId: household.id,
      familyMemberId: hillary.id,
      email: "hillarytonkinson@gmail.com",
      name: "Hillary Tonkinson",
    })
    .returning();

  if (!hillaryUser) throw new Error("Failed to create hillaryUser");
  console.log("Created users:", calebUser.id, hillaryUser.id);

  // Create themes
  const [homeTheme] = await db
    .insert(themes)
    .values({
      householdId: household.id,
      name: "Home Maintenance",
      icon: "home",
      color: "#4A90D9",
      sortOrder: 1,
    })
    .returning();

  if (!homeTheme) throw new Error("Failed to create homeTheme");

  const [financeTheme] = await db
    .insert(themes)
    .values({
      householdId: household.id,
      name: "Finance",
      icon: "dollar-sign",
      color: "#50C878",
      sortOrder: 2,
    })
    .returning();

  if (!financeTheme) throw new Error("Failed to create financeTheme");

  const [healthTheme] = await db
    .insert(themes)
    .values({
      householdId: household.id,
      name: "Health & Wellness",
      icon: "heart",
      color: "#FF6B6B",
      sortOrder: 3,
    })
    .returning();

  if (!healthTheme) throw new Error("Failed to create healthTheme");
  console.log("Created themes:", homeTheme.id, financeTheme.id, healthTheme.id);

  // Create a project
  const [kitchenProject] = await db
    .insert(projects)
    .values({
      householdId: household.id,
      themeId: homeTheme.id,
      name: "Kitchen Renovation",
      description: "Update kitchen appliances and cabinets",
      isActive: true,
    })
    .returning();

  if (!kitchenProject) throw new Error("Failed to create kitchenProject");
  console.log("Created project:", kitchenProject.id);

  // Create some tasks
  await db.insert(tasks).values([
    {
      householdId: household.id,
      themeId: homeTheme.id,
      title: "Replace HVAC filter",
      description: "Replace the furnace filter - 20x25x1 size",
      status: "todo",
      createdById: calebUser.id,
      assignedToId: caleb.id,
      isRecurring: true,
      recurrenceType: "monthly",
      recurrenceInterval: 1,
      priority: 1,
    },
    {
      householdId: household.id,
      themeId: homeTheme.id,
      projectId: kitchenProject.id,
      title: "Research refrigerator options",
      description: "Look into energy-efficient refrigerator models",
      status: "todo",
      createdById: hillaryUser.id,
      priority: 0,
    },
    {
      householdId: household.id,
      themeId: financeTheme.id,
      title: "Review monthly budget",
      description: "Check spending against budget categories",
      status: "todo",
      createdById: calebUser.id,
      assignedToId: caleb.id,
      isRecurring: true,
      recurrenceType: "monthly",
      recurrenceInterval: 1,
      priority: 1,
    },
    {
      householdId: household.id,
      themeId: healthTheme.id,
      title: "Schedule annual checkups",
      description: "Book annual physicals for both of us",
      status: "todo",
      createdById: hillaryUser.id,
      assignedToId: hillary.id,
      priority: 0,
    },
  ]);

  console.log("Created sample tasks");

  console.log("Seed completed successfully!");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
