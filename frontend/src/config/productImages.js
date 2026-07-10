/**
 * Product image paths — files live in frontend/public/products/
 * Replace filenames with your real Zylk Health product photos.
 */
export const PRODUCT_IMAGES = {
  "prod-rosemary-concentrate": "/products/rosemary-serum.jpg",
  "prod-minox-male-rx": "/products/minoxidil-male.jpg",
  "prod-minox-female-rx": "/products/minoxidil-female.jpg",
  "prod-oil-mct-dandruff": "/products/progro-oil-dandruff.jpg",
  "prod-oil-jojoba-clear": "/products/progro-oil-jojoba.jpg",
  "prod-derma": "/products/derma-roller.jpg",
  "prod-shampoo": "/products/shampoo.jpg",
  "prod-massager": "/products/scalp-massager.jpg",
  "hair-health-mix": "/products/health-mix.jpg",
};

const DEFAULT_IMAGE = "/products/default-product.png";

export function getProductImage(productId) {
  return PRODUCT_IMAGES[productId] || DEFAULT_IMAGE;
}

/** Attach image URL to any product object */
export function withProductImage(product) {
  return {
    ...product,
    imgUrl: product.imgUrl || getProductImage(product.id),
  };
}