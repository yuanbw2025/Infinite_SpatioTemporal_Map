import { inject } from "vue";
import { applicationRuntimeKey } from "../platform/application";

export function useApplication() {
  const runtime = inject(applicationRuntimeKey);
  if (!runtime) {
    throw new Error("Application runtime is not available");
  }
  return runtime;
}
