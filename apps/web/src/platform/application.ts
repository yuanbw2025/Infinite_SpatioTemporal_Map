import {
  createEmptyPublication,
  createStaticPublicationRepository,
} from "@infinite-spacetime/adapters";
import {
  createApplicationServices,
  type ApplicationServices,
} from "@infinite-spacetime/core";
import type { InjectionKey } from "vue";

/** Composition root: this is the only place where UI meets a data adapter. */
export const applicationServices = createApplicationServices(
  createStaticPublicationRepository(createEmptyPublication()),
);

export const applicationServicesKey: InjectionKey<ApplicationServices> = Symbol(
  "infinite-spacetime-application-services",
);
