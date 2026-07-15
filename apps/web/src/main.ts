import { createApp } from "vue";
import App from "./App.vue";
import {
  applicationServices,
  applicationServicesKey,
} from "./platform/application";
import { router } from "./router";
import "./style.css";

createApp(App)
  .provide(applicationServicesKey, applicationServices)
  .use(router)
  .mount("#app");
