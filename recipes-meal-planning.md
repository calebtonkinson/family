# Recipes and Meal Planning: Full Concept

This document defines the product concept for recipes and meal planning, with emphasis on separating ingredients from instructions, minimizing complexity in steps, and allowing recipe creation from photos via the assistant.

## Principles
- Separate ingredients from instructions.
- Keep instructions simple and short; no deep multi-step nesting.
- Make recipe creation easy: manual entry or photo-to-recipe via chat.
- Focus on family routines (weekly planning, repeatable meals, grocery automation).

## Core Objects
- Recipe
  - Title
  - Description (optional)
  - Ingredients (structured list)
  - Instructions (simple ordered list)
  - Tags (e.g., breakfast, kid-friendly, quick)
  - Prep time / Cook time (optional)
  - Yield / servings (optional)
  - Source (photo, link, manual, family)
  - Notes (optional)

- Ingredient (structured)
  - Name
  - Quantity
  - Unit
  - Optional qualifiers (e.g., "chopped," "low-sodium")

- Meal Plan
  - Date
  - Meal slot (breakfast, lunch, dinner, snacks)
  - Assigned recipe(s)
  - People covered

- Grocery List
  - Generated from meal plan + pantry
  - Editable and assignable

## Recipe Format (Recommended)
This is the suggested structure for recipe creation and display.

### Ingredients
- One item per line: Quantity + Unit + Ingredient + Qualifiers
- Example lines
  - 1 lb chicken thighs, boneless
  - 2 tbsp olive oil
  - 1 tsp kosher salt
  - 1 cup cherry tomatoes, halved

### Instructions
- Simple, short ordered list
- Each line is one action, no sub-steps
- Example
  1. Preheat oven to 425 F.
  2. Toss chicken with olive oil, salt, and pepper.
  3. Spread chicken and tomatoes on a sheet pan.
  4. Roast for 25 minutes, until browned.

## Photo-to-Recipe (Assistant Flow)
Goal: Open the assistant, take a photo of a recipe, and add it to the family cookbook.

### Flow
1. User opens chat assistant and uploads or takes a photo.
2. Assistant extracts text from the image (OCR).
3. Assistant parses text into:
   - Title
   - Ingredients list
   - Instructions list
4. Assistant shows a review screen:
   - Editable fields
   - Confidence highlights (low confidence lines flagged)
5. User confirms and saves to cookbook.

### Edge Cases
- Photos of handwritten recipes
- Recipes with mixed formats (ingredients embedded in steps)
- Portion sizes or temperatures missing
- Multi-column cookbook pages

## Meal Planning Experience
- Weekly view with drag-and-drop recipe cards.
- Quick add for leftovers or "no recipe" meals.
- Auto-suggestions based on:
  - Family preferences
  - Time available
  - Pantry inventory
  - Past week history

## Grocery Integration
- Auto-generate grocery list from planned meals.
- De-duplicate ingredients across recipes.
- Normalize units (oz, lb, cup).
- Allow substitutions and manual edits.
- Assign items to a person (who is buying).

## Permissions and Roles
- Family cookbook is shared by default.
- Private recipes supported (personal only).
- Kids can view and help choose meals; restricted edit permissions.

## AI Assistance Ideas
- "Plan dinners for next week" based on constraints.
- "Make a quick grocery list" from selected recipes.
- "Turn this picture into a recipe" directly from chat.
- "Suggest a swap" for missing ingredients.

## MVP Scope Recommendation
- Recipe CRUD with separated ingredients and instructions
- Photo-to-recipe creation in chat
- Weekly meal plan with recipe assignment
- Grocery list generation

## Future Enhancements
- Pantry tracking with barcode scan
- Nutrition data auto-enrichment
- Recipe scaling by servings
- Kids-friendly cooking steps
- Meal rating and feedback loops

## Implementation Task Breakdown

A prioritized task list for building the basics: recipe creation, meal plan creation, AI recipe search, AI meal plan construction, and user preference notes that the model consumes when planning.

### Phase 1: Data & Schema

**1. Recipe schema and migration**
- Add Drizzle schema for `recipes` table: `household_id`, `title`, `description`, `ingredients_json` (or normalized `ingredients` rows), `instructions_json`, `tags` (array or JSONB), `prep_time`, `cook_time`, `yield_servings`, `source` enum (photo, link, manual, family), `notes`, `created_at`, `updated_at`
- Ingredient structure: name, quantity, unit, qualifiers (e.g., "chopped", "low-sodium")
- Generate and run migration in `packages/db`

**2. Meal plan schema and migration**
- Add `meal_plans` table: `household_id`, `date`, `meal_slot` enum (breakfast, lunch, dinner, snacks), `recipe_id` FK (nullable for "no recipe"/leftovers), `people_covered`, `notes`
- Generate and run migration

**3. Meal planning preferences schema**
- Add `meal_planning_preferences` table: `household_id`, `notes` (TEXT), `created_at`, `updated_at`
- One row per household; or support multiple preference "snippets" if desired
- Generate and run migration

### Phase 2: Recipe Basics

**4. Recipe API routes**
- `GET /recipes` – list recipes for household (with filters: tags, search)
- `POST /recipes` – create recipe
- `GET /recipes/:id` – get single recipe
- `PATCH /recipes/:id` – update recipe
- `DELETE /recipes/:id` – delete recipe

**5. Recipe UI – list and create**
- Recipes page at `/recipes`
- Recipe list with cards (title, tags, prep/cook time)
- Create recipe form: title, ingredients (structured list), instructions (ordered list), tags
- `useRecipes` hook mirroring `useTasks` pattern

**6. Recipe UI – detail and edit**
- Recipe detail page at `/recipes/[id]`
- Edit form (same fields as create)

### Phase 3: Meal Planning Preferences

**7. Preferences API**
- `GET /meal-planning-preferences` – return household preferences
- `PUT /meal-planning-preferences` – upsert preferences (single text field or list of notes)

**8. Preferences UI**
- Settings page section or dedicated page for "Meal planning preferences"
- Simple textarea or list of "preference notes" that the model will consume when planning

### Phase 4: Meal Plan Basics

**9. Meal plan API**
- `GET /meal-plans` – list plans (filter by date range)
- `POST /meal-plans` – create plan entry
- `PATCH /meal-plans/:id` – update plan entry
- `DELETE /meal-plans/:id` – delete plan entry

**10. Meal plan UI**
- Meal plan page at `/meal-plans` or `/recipes/plan`
- Week view (dates × meal slots)
- Assign recipe to slot (dropdown or search)
- Support "no recipe" / leftovers placeholder

### Phase 5: AI Tools for Recipes & Meal Planning

**11. Recipe AI tools**
- `searchRecipes` – search/filter recipes by title, tags, ingredients
- `listRecipes` – list recipes for household
- `createRecipe` – create recipe from structured input (for chat/photo-to-recipe later)

**12. Meal planning AI tools**
- `getMealPlanningPreferences` – fetch household preferences to inject into planning context
- `createMealPlan` – create plan entries (date, slot, recipe_id, people_covered)
- `listMealPlans` – list existing plans for date range

**13. System prompt for meal planning**
- Extend assistant prompt with meal-planning capabilities
- When planning, call `getMealPlanningPreferences` and inject output into context
- Document how to use `searchRecipes` + `createMealPlan` for requests like "plan dinners for next week"

### Phase 6: AI Meal Plan Construction Flow

**14. End-to-end meal plan flow**
- User asks: "Plan dinners for next week"
- Assistant: `getMealPlanningPreferences` → `searchRecipes` / `listRecipes` → `createMealPlan`
- Assistant responds with summary of created plan

### Execution Order

| # | Task |
|---|------|
| 1 | Recipe schema + migration |
| 2 | Meal plan schema + migration |
| 3 | Meal planning preferences schema |
| 4 | Recipe API routes |
| 5 | Recipe UI (list, create, detail, edit) |
| 6 | Meal planning preferences API |
| 7 | Meal planning preferences UI |
| 8 | Meal plan API |
| 9 | Meal plan UI (week view) |
| 10 | Recipe AI tools (`searchRecipes`, `listRecipes`, `createRecipe`) |
| 11 | Meal planning AI tools (`getMealPlanningPreferences`, `createMealPlan`, `listMealPlans`) |
| 12 | System prompt update for meal planning |
| 13 | Validate "Plan dinners for next week" flow |

*Photo-to-recipe (OCR in chat) and grocery list can be added once this foundation is in place.*

## Home Systems Record (New Concept)
This concept captures key information about the systems that run the home (appliances, utilities, devices, services) so the family can find it quickly and the assistant can help with maintenance, troubleshooting, and vendor coordination.

### Core Objects
- System
  - Name (e.g., HVAC, water heater, garage door opener)
  - Category (appliance, utility, network, security, etc.)
  - Location (basement, attic, kitchen)
  - Model / serial
  - Install date
  - Warranty end date
  - Vendor / service provider
  - Manuals / documents
  - Maintenance schedule
  - Notes and known issues

- Service Record
  - System reference
  - Date
  - Work performed
  - Vendor
  - Cost
  - Attachments (invoice, photos)

### Capture and Retrieval
- Quick capture from chat (text + photo of labels/serial numbers).
- Scan documents (manuals, receipts, warranties) and attach to systems.
- Search by location, system name, or model number.

### Assistant Use Cases
- Remind about maintenance (filter changes, seasonal tune-ups).
- Provide troubleshooting steps using stored manuals.
- Suggest vendors based on past service history.
- Surface warranty status when a system fails.

### MVP Scope Recommendation
- System CRUD with attachments
- Simple maintenance reminders
- Service record log

### Future Enhancements
- Warranty expiration alerts
- Vendor auto-scheduling
- Integration with smart home devices
