# Testimonial before / after photos

## Steps (copy → paste path)

1. Copy your images into this folder:
   `frontend/public/testimonials/`
2. Open `frontend/src/components/Result.jsx`
3. Find `TESTIMONIALS` → `photos`
4. Paste your path or filename into `file:`

Examples that all work:

```js
{ label: "Before", file: "ajay-before.jpg" }
{ label: "Before", file: "/testimonials/ajay-before.jpg" }
{ label: "Before", file: "C:\\Users\\DELL\\Desktop\\hair-scalp-quiz\\frontend\\public\\testimonials\\ajay-before.jpg" }
```

Windows full paths are fine — only the **filename** is used, so the file must still live in this folder.

## Suggested filenames

| Person | Files |
|--------|--------|
| Ajay Kumar | `ajay-before.jpg`, `ajay-after.jpg` (optional: `ajay-month-4.jpg`) |
| Rahul Mehta | `rahul-before.jpg`, `rahul-after.jpg` (optional: `rahul-month-3.jpg`) |

Tips:
- Same crop/framing for before and after works best
- Square or 3:4, ~800–1200px wide
- Restart `npm run dev` if a new image does not show
