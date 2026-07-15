import { createApp } from "vue";
import App from "./App.vue";
import {
  applicationRuntimeKey,
  initializeApplicationRuntime,
} from "./platform/application";
import { router } from "./router";
import "./style.css";

const runtime = await initializeApplicationRuntime();

createApp(App)
  .provide(applicationRuntimeKey, runtime)
  .use(router)
  .mount("#app");
