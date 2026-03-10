import { describe, expect, it } from "vitest";
import { extractRecipePage } from "./recipe-url-import";

describe("recipe URL import helpers", () => {
  it("prefers recipe JSON-LD when present", () => {
    const html = `
      <html>
        <head>
          <title>Chicken Tacos</title>
          <meta property="og:image" content="/hero.jpg" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Crispy Chicken Tacos",
              "description": "Weeknight tacos with crunchy edges.",
              "recipeYield": "4 servings",
              "image": "https://cdn.example.com/tacos.jpg",
              "recipeIngredient": ["1 lb chicken thighs", "8 tortillas"],
              "recipeInstructions": [
                { "@type": "HowToStep", "text": "Season the chicken." },
                { "@type": "HowToStep", "text": "Roast until crisp." }
              ]
            }
          </script>
        </head>
        <body>
          <article>
            <p>Long story about dinner.</p>
          </article>
        </body>
      </html>
    `;

    const extracted = extractRecipePage(
      html,
      "https://recipes.example.com/crispy-chicken-tacos",
    );

    expect(extracted.recipeJsonLd).toEqual({
      title: "Crispy Chicken Tacos",
      description: "Weeknight tacos with crunchy edges.",
      imageUrl: "https://cdn.example.com/tacos.jpg",
      yieldServings: 4,
      ingredients: ["1 lb chicken thighs", "8 tortillas"],
      instructions: ["Season the chicken.", "Roast until crisp."],
    });
    expect(extracted.imageUrl).toBe("https://cdn.example.com/tacos.jpg");
    expect(extracted.siteName).toBe("recipes.example.com");
  });

  it("falls back to page metadata and visible text when recipe JSON-LD is missing", () => {
    const html = `
      <html>
        <head>
          <title>One Pot Pasta</title>
          <meta name="description" content="Simple pantry pasta." />
          <meta property="og:image" content="https://cdn.example.com/pasta.jpg" />
        </head>
        <body>
          <main>
            <h1>One Pot Pasta</h1>
            <p>Saute garlic.</p>
            <p>Add pasta and broth.</p>
          </main>
        </body>
      </html>
    `;

    const extracted = extractRecipePage(html, "https://example.com/pasta");

    expect(extracted.recipeJsonLd).toBeNull();
    expect(extracted.title).toBe("One Pot Pasta");
    expect(extracted.description).toBe("Simple pantry pasta.");
    expect(extracted.imageUrl).toBe("https://cdn.example.com/pasta.jpg");
    expect(extracted.textContent).toContain("Saute garlic.");
    expect(extracted.textContent).toContain("Add pasta and broth.");
  });
});
