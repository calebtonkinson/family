import { Suspense } from "react";
import NewProjectClient from "./new-project-client";

export default function NewProjectPage() {
  return (
    <Suspense>
      <NewProjectClient />
    </Suspense>
  );
}
