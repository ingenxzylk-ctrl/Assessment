# Testimonial before / after photos

Drop files here. Served at `/testimonials/<filename>`.

## Expected filenames

| Person | Files |
|--------|--------|
| Ajay Kumar | `ajay-before.jpg`, `ajay-after.jpg` (optional `ajay-month-4.jpg`) |
| Rahul Mehta | `rahul-before.jpg`, `rahul-after.jpg` (optional `rahul-month-3.jpg`) |

`.png` / `.webp` also work — the app tries alternate extensions automatically.

You can also paste a full Windows path in `Result.jsx` `TESTIMONIALS.photos.file`; only the filename is used.

Restart `npm run dev` after adding images.
