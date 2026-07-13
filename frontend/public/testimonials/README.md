# Testimonial before / after photos

Drop JPG/PNG/WebP files here. They are served at `/testimonials/<filename>`.

## Expected filenames (used by Result page)

| Person | Files |
|--------|--------|
| Ajay Kumar | `ajay-before.jpg`, `ajay-after.jpg` (optional: `ajay-month-4.jpg`) |
| Rahul Mehta | `rahul-before.jpg`, `rahul-after.jpg` (optional: `rahul-month-3.jpg`) |

Tips:
- Use the same crop/framing for before and after (head/scalp close-up works best).
- Prefer square or 3:4, around 800–1200px wide.
- After adding files, restart `npm run dev` if images do not show.

To add another story, put new files here and add a matching entry in `TESTIMONIALS` inside `frontend/src/components/Result.jsx`.
