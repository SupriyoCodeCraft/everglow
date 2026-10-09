/* ============================================================
   FOR YOU, WITH LOVE
   Personalize the ending by editing CONFIG below, or use URL:
   ?name=Her%20Name&message=Your%20personal%20message
   ============================================================ */

const CONFIG = {
  name: "My favourite person",
  message: "I'd still find a thousand little ways to choose you.",
  openingLine: "Some feelings deserve<br><em>their own little universe.</em>",
  kicker: "IF THE WHOLE WORLD WENT QUIET…",
  signature: "MADE WITH ALL MY HEART"
};

const $ = (selector) => document.querySelector(selector);
const scene = $("#scene");
const canvas = $("#particles");
const ctx = canvas.getContext("2d");
const heartPath = $("#heartPath");
const heartInner = $(".heart-inner");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function applyPersonalization() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name");
  const message = params.get("message");
  $("#herName").textContent = name ? name.slice(0, 70) : CONFIG.name;
  $("#personalNote").textContent = message ? message.slice(0, 240) : CONFIG.message;
  $("#openingLine").innerHTML = CONFIG.openingLine;
  const kicker = $(".message-kicker");
  if (kicker) kicker.textContent = CONFIG.kicker;
  $("#signature").textContent = CONFIG.signature;
}
applyPersonalization();

/* A lightweight canvas field: glowing dust, not image assets. */
let width = 0, height = 0, dpr = 1, particles = [], rafId = 0;
const particleCount = () => Math.min(105, Math.max(48, Math.floor(window.innerWidth / 8)));
const rand = (min, max) => Math.random() * (max - min) + min;

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const target = particleCount();
  if (particles.length < target) {
    while (particles.length < target) particles.push(makeParticle(true));
  } else {
    particles.length = target;
  }
}
function makeParticle(randomY = false) {
  return {
    x: rand(0, width || innerWidth),
    y: randomY ? rand(0, height || innerHeight) : (height || innerHeight) + rand(0, 20),
    r: rand(.35, 1.6),
    vy: rand(.08, .32),
    vx: rand(-.12, .12),
    alpha: rand(.12, .72),
    phase: rand(0, Math.PI * 2),
    twinkle: rand(.008, .025),
    gold: Math.random() > .55
  };
}
function drawParticles() {
  ctx.clearRect(0, 0, width, height);
  for (const p of particles) {
    p.y -= p.vy;
    p.x += p.vx + Math.sin(p.phase) * .08;
    p.phase += p.twinkle;
    if (p.y < -8) Object.assign(p, makeParticle(false));
    if (p.x < -8) p.x = width + 8;
    if (p.x > width + 8) p.x = -8;
    const alpha = p.alpha * (.72 + Math.sin(p.phase) * .28);
    ctx.beginPath();
    ctx.fillStyle = p.gold ? `rgba(242, 204, 143, ${alpha})` : `rgba(224, 145, 169, ${alpha * .72})`;
    ctx.shadowBlur = p.r > 1.2 ? 9 : 0;
    ctx.shadowColor = p.gold ? "rgba(255, 208, 137, .8)" : "rgba(219, 106, 145, .7)";
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  rafId = requestAnimationFrame(drawParticles);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas, { passive: true });
drawParticles();

/* Main timeline. GSAP CDN is optional; the fallback still reveals the message. */
function runFallback() {
  $("#intro").style.transition = "opacity 900ms ease";
  $("#intro").style.opacity = "0";
  setTimeout(() => {
    $("#heartStage").style.transition = "opacity 900ms ease";
    $("#heartStage").style.opacity = "0";
    $("#loveMessage").style.transition = "opacity 1200ms ease, transform 1200ms ease";
    $("#loveMessage").style.opacity = "1";
    $("#loveMessage").style.transform = "translateY(0)";
    document.querySelectorAll(".word, .her-name, .personal-note, .end-heart, .signature, .replay")
      .forEach(el => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
  }, 3800);
}

function playAnimation() {
  if (!window.gsap || reducedMotion) {
    runFallback();
    return;
  }

  const gsap = window.gsap;
  gsap.killTweensOf("*");
  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

  // Reset all animated elements for replay.
  gsap.set(["#intro", "#eyebrow", "#openingLine", "#heartStage", "#loveMessage",
    ".word", ".her-name", ".personal-note", ".end-heart", ".signature", ".replay"],
    { clearProps: "all" });
  gsap.set("#heartPath", { strokeDasharray: 1000, strokeDashoffset: 1000, opacity: 1 });
  gsap.set(heartInner, { opacity: 0, scale: .8, transformOrigin: "50% 50%" });
  gsap.set("#heartStage", { opacity: 0, scale: .72, y: 12, filter: "blur(7px)" });
  gsap.set("#loveMessage", { opacity: 0, y: 18 });
  gsap.set(".word", { opacity: 0, y: 20, filter: "blur(8px)" });
  gsap.set([".her-name", ".personal-note", ".end-heart", ".signature", ".replay"], { opacity: 0, y: 10 });

  tl.to(".ambient--one", { opacity: .36, scale: 1.08, duration: 2.6 }, 0)
    .to(".ambient--two", { opacity: .19, scale: 1.1, duration: 3.2 }, 0)
    .fromTo("#eyebrow", { opacity: 0, y: 8, letterSpacing: ".42em" }, { opacity: 1, y: 0, letterSpacing: ".28em", duration: 1.15 }, .25)
    .fromTo("#openingLine", { opacity: 0, y: 15, filter: "blur(7px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.5 }, .7)
    .to("#intro", { opacity: 0, y: -16, duration: 1.0, ease: "power2.inOut" }, 3.0)
    .to("#heartStage", { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", duration: 1.25, ease: "back.out(1.4)" }, 3.45)
    .to("#heartPath", { strokeDashoffset: 0, duration: 2.25, ease: "power1.inOut" }, 3.75)
    .to(".heart-halo", { scale: 1.3, opacity: .9, duration: 1.1, yoyo: true, repeat: 1, ease: "sine.inOut" }, 4.1)
    .to("#heartStage", { scale: 1.055, duration: .42, yoyo: true, repeat: 1, ease: "sine.inOut" }, 6.05)
    .to(heartInner, { opacity: .13, scale: 1, duration: .65 }, 6.1)
    .to(".heart-core", { opacity: 1, scale: 1.4, duration: .3, yoyo: true, repeat: 1 }, 6.35)
    // The heart gathers into a line of light before the typography takes over.
    .to("#heartStage", { scaleX: 1.65, scaleY: .12, opacity: .72, filter: "blur(5px)", duration: .72, ease: "power3.in" }, 7.15)
    .to("#heartStage", { opacity: 0, scale: .45, duration: .45, ease: "power2.in" }, 7.78)
    .to("#loveMessage", { opacity: 1, y: 0, duration: .9, ease: "power3.out" }, 7.85)
    .to(".word", { opacity: 1, y: 0, filter: "blur(0px)", duration: .9, stagger: .23, ease: "power3.out" }, 8.15)
    .to(".her-name", { opacity: 1, y: 0, duration: 1.1, ease: "power2.out" }, 9.25)
    .to(".personal-note", { opacity: 1, y: 0, duration: 1.2, ease: "power2.out" }, 9.75)
    .to(".end-heart", { opacity: .95, scale: 1.12, duration: .7, ease: "back.out(2)" }, 10.55)
    .to(".end-heart", { scale: 1, duration: 1.15, repeat: -1, yoyo: true, ease: "sine.inOut" }, 11.3)
    .to(".signature", { opacity: 1, duration: 1.2 }, 10.8)
    .to(".replay", { opacity: 1, y: 0, duration: .8 }, 11.1);
}

$("#replay").addEventListener("click", () => {
  if (window.gsap) window.gsap.killTweensOf("*");
  playAnimation();
});
window.addEventListener("load", () => {
  // Give the browser one frame to paint the dark scene before the first movement.
  requestAnimationFrame(() => setTimeout(playAnimation, 180));
});
