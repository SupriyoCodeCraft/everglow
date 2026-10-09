# For You, With Love ❤️

A cinematic, mobile-first romantic reveal made with plain HTML, CSS, and vanilla JavaScript. GSAP is loaded from CDN for the animation timeline. No React, build step, backend, or database.

## Run locally
Open `index.html` in a browser. For the most reliable local behavior, use VS Code's Live Server extension.

## Personalize the message

### Option 1: Edit `script.js`
At the top of `script.js`, change:

```js
const CONFIG = {
  name: "Her name",
  message: "Write your personal message here.",
  openingLine: "Some feelings deserve<br><em>their own little universe.</em>",
  kicker: "IF THE WHOLE WORLD WENT QUIET…",
  signature: "MADE WITH ALL MY HEART"
};
```

### Option 2: Share a personalized URL
You can personalize the name and message without editing the files:

`https://your-project.vercel.app/?name=Her%20Name&message=Your%20personal%20message`

Use URL encoding for spaces and special characters. The page limits the displayed name and message length.

## Deploy to Vercel
1. Put `index.html`, `style.css`, and `script.js` in the project root.
2. Push the folder to a GitHub repository, or import the folder/repository into Vercel.
3. For a static site, no build command is needed. Set the output directory to `.` if Vercel asks for one.
4. Deploy. The site uses relative asset paths, so it works from the project root.

## Notes
- GSAP is loaded from jsDelivr. If the CDN is unavailable, a simple fallback still reveals the message.
- Google Fonts are used for Cormorant Garamond and DM Sans; system serif/sans fallbacks are defined.
- Background particles are drawn on Canvas and use no external image assets.
- The animation respects the operating system's reduced-motion preference.
- There is no audio by default, so the experience opens silently and won't surprise anyone in a quiet place.
