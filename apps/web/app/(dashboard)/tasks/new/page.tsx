import { Suspense } from "react";
import NewTaskClient from "./new-task-client";

export default function NewTaskPage() {
  return (
    <Suspense>
      <NewTaskClient />
    </Suspense>
  );
}
