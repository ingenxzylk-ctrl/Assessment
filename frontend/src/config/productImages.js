/**
 * Product image paths — files live in frontend/public/products/
 * Replace filenames with your real Zylk Health product photos.
 */
export const PRODUCT_IMAGES = {
  "zylk-minoxidil-5": "/products/minoxidil-5.jpg",
  "zylk-minoxidil-2": "/products/minoxidil-2.jpg",
  "zylk-rosemary-oil": "/products/rosemary-oil.jpg",
  "zylk-progro-oil": "/products/progro-oil.jpg",
  "zylk-detox-shampoo": "/products/detox-shampoo.jpg",
  "zylk-antidandruff-shampoo": "/products/antidandruff-shampoo.jpg",
  "zylk-dermaroller": "/products/dermaroller.jpg",
  "zylk-scalp-massager": "/products/scalp-massager.jpg",
  "zylk-tea-tree-conditioner": "/products/tea-tree-conditioner.jpg",
  "zylk-tea-tree-mist": "/products/tea-tree-mist.jpg",
  "zylk-rosemary-mist": "/products/rosemary-mist.jpg",
  "zylk-hair-health-mix": "/products/hair-health-mix.jpg",
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