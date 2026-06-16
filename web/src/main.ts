import * as ElIcons from "@element-plus/icons-vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./styles.css";

const app = createApp(App);
for (const [name, comp] of Object.entries(ElIcons)) {
  app.component(name, comp as never);
}
app.use(ElementPlus).use(router).mount("#app");
