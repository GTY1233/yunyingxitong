import { createRouter, createWebHistory } from "vue-router";
import Accounts from "./views/Accounts.vue";
import AssetLibrary from "./views/AssetLibrary.vue";
import Dashboard from "./views/Dashboard.vue";
import Inventory from "./views/Inventory.vue";
import ModelLibrary from "./views/ModelLibrary.vue";
import ReferenceVideoLibrary from "./views/ReferenceVideoLibrary.vue";
import ProductDetail from "./views/ProductDetail.vue";
import ProductList from "./views/ProductList.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", name: "dashboard", component: Dashboard },
    { path: "/products", name: "products", component: ProductList },
    { path: "/products/:id", name: "product-detail", component: ProductDetail },
    { path: "/inventory", name: "inventory", component: Inventory },
    { path: "/assets", name: "assets", component: AssetLibrary },
    { path: "/models", name: "models", component: ModelLibrary },
    { path: "/reference-videos", name: "reference-videos", component: ReferenceVideoLibrary },
    { path: "/accounts", name: "accounts", component: Accounts },
  ],
});
