/**
 * Testimonial before/after photos from public/testimonials.
 *
 * Put files in: frontend/public/testimonials/
 * Served at:    /testimonials/<filename>
 */

const EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export function getTestimonialPhotoUrl(file) {
  if (!file) return null;
  if (/^https?:\/\//i.test(file) || file.startsWith("/") || file.startsWith("data:")) {
    return file;
  }
  return `/testimonials/${file}`;
}

export function getTestimonialPhotoFallbacks(file) {
  if (!file || file.includes(".") || file.startsWith("/") || /^https?:\/\//i.test(file)) {
    return [];
  }
  return EXTENSIONS.map((ext) => `/testimonials/${file}.${ext}`);
}

export function resolveTestimonialPhotos(photos = []) {
  return photos
    .map((photo) => {
      const file = typeof photo === "string" ? photo : photo?.file;
      if (!file) return null;
      const label = typeof photo === "string" ? "" : photo.label || "";
      const src = getTestimonialPhotoUrl(file.includes(".") || file.startsWith("/") ? file : `${file}.jpg`);
      const fallbacks = file.includes(".")
        ? []
        : getTestimonialPhotoFallbacks(file).filter((u) => u !== src);
      return { label, src, fallbacks };
    })
    .filter(Boolean);
}
