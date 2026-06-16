import { createRouter, createWebHistory } from "vue-router";
import ProductDetail from "./views/ProductDetail.vue";
import ProductList from "./views/ProductList.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/products" },
    { path: "/products", name: "products", component: ProductList },
    { path: "/products/:id", name: "product-detail", component: ProductDetail },
  ],
});
