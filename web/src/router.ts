import { createRouter, createWebHistory } from "vue-router";
import Accounts from "./views/Accounts.vue";
import Dashboard from "./views/Dashboard.vue";
import ProductDetail from "./views/ProductDetail.vue";
import ProductList from "./views/ProductList.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", name: "dashboard", component: Dashboard },
    { path: "/products", name: "products", component: ProductList },
    { path: "/products/:id", name: "product-detail", component: ProductDetail },
    { path: "/accounts", name: "accounts", component: Accounts },
  ],
});
