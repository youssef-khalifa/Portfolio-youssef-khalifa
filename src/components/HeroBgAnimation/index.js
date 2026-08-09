import React, { useEffect, useRef } from "react";
import { Div, Canvas, AuroraShift, Aurora } from "./HeroBgAnimationStyle";
import { createNodeSphere } from "./nodeSphere";

const PALETTE = [
  [148, 93, 214], // #945DD6
  [133, 76, 230], // #854CE6
  [19, 173, 199], // #13ADC7
];

const LINK_DIST = 132; // px between particles before a line is drawn
const CURSOR_DIST = 190; // px of cursor influence

/**
 * Hero backdrop: an ambient particle field and, in front of it, the large node
 * mesh that carries the section. Both are drawn on one canvas off one render
 * loop, over two drifting colour washes.
 *
 * The two share a vocabulary on purpose — dots, link threads, a few brighter
 * hubs — and both answer to the pointer: particles scatter and thread to the
 * cursor, the mesh deforms away from it, leans toward it, and ripples on click.
 *
 * Honours prefers-reduced-motion (renders one static frame) and stops the
 * render loop whenever the tab is hidden or the hero scrolls out of view.
 */
const HeroBgAnimation = () => {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let raf = 0;
    let running = true;
    let visible = true;
    let last = 0;

    const pointer = { x: -9999, y: -9999, active: false };
    const sphere = createNodeSphere();
    sphere.setReducedMotion(reduced);

    // Pre-rendered glow sprite — far cheaper than shadowBlur per particle.
    const glow = document.createElement("canvas");
    const glowCtx = glow.getContext("2d");
    const GLOW_R = 22;
    glow.width = GLOW_R * 2;
    glow.height = GLOW_R * 2;
    const grad = glowCtx.createRadialGradient(
      GLOW_R,
      GLOW_R,
      0,
      GLOW_R,
      GLOW_R,
      GLOW_R
    );
    grad.addColorStop(0, "rgba(160,110,240,0.55)");
    grad.addColorStop(0.4, "rgba(160,110,240,0.15)");
    grad.addColorStop(1, "rgba(160,110,240,0)");
    glowCtx.fillStyle = grad;
    glowCtx.fillRect(0, 0, GLOW_R * 2, GLOW_R * 2);

    const seed = () => {
      // density scales with area, but stays sane on large monitors. Kept
      // deliberately sparse so it reads as backdrop behind the node mesh.
      const target = Math.round((width * height) / 19000);
      const count = Math.max(24, Math.min(88, target));
      particles = new Array(count).fill(null).map(() => {
        const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.32,
          vy: (Math.random() - 0.5) * 0.32,
          r: Math.random() * 1.7 + 0.9,
          c,
          // a few brighter "hub" nodes read as intentional rather than noise
          hub: Math.random() < 0.14,
        };
      });
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      sphere.layout(width, height);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // connections first, so nodes sit on top
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DIST * LINK_DIST) continue;
          const d = Math.sqrt(d2);
          const a = (1 - d / LINK_DIST) * 0.26;
          ctx.strokeStyle = `rgba(148,93,214,${a.toFixed(3)})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }

        // cursor threads
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < CURSOR_DIST) {
            const a = (1 - d / CURSOR_DIST) * 0.55;
            ctx.strokeStyle = `rgba(19,173,199,${a.toFixed(3)})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        if (p.hub) {
          ctx.drawImage(glow, p.x - GLOW_R, p.y - GLOW_R);
        }
        const [r, g, b] = p.c;
        ctx.fillStyle = `rgba(${r},${g},${b},${p.hub ? 0.72 : 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.hub ? p.r * 1.7 : p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // the mesh is the focal element, so it sits in front of the field
      sphere.draw(ctx);
    };

    const step = (dt) => {
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // gentle push away from the cursor
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < CURSOR_DIST && d > 0.01) {
            const force = (1 - d / CURSOR_DIST) * 0.5;
            p.x += (dx / d) * force;
            p.y += (dy / d) * force;
          }
        }

        // wrap rather than bounce — no visible edges
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      }

      sphere.update(dt);
    };

    /** Reduced motion parks the loop, so cursor response needs a manual tick. */
    const repaint = () => {
      if (!reduced) return;
      sphere.update(1 / 60);
      draw();
    };

    const loop = (now) => {
      if (!running || !visible) return;
      // clamp so a backgrounded tab doesn't jump everything on return
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      step(dt);
      draw();
      raf = window.requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf || reduced) return;
      last = 0;
      raf = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    };

    const onPointerMove = (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      pointer.x = x;
      pointer.y = y;
      pointer.active =
        x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;

      // normalised to -0.5..0.5, shared by the mesh and the colour washes
      const nx = rect.width ? x / rect.width - 0.5 : 0;
      const ny = rect.height ? y / rect.height - 0.5 : 0;
      sphere.setPointer(x, y, pointer.active, nx, ny);

      if (pointer.active) {
        wrap.style.setProperty("--px", nx.toFixed(3));
        wrap.style.setProperty("--py", ny.toFixed(3));
      }
      repaint();
    };

    const onPointerLeave = () => {
      pointer.active = false;
      sphere.setPointer(-9999, -9999, false, 0, 0);
      wrap.style.setProperty("--px", "0");
      wrap.style.setProperty("--py", "0");
      repaint();
    };

    const onPointerDown = () => {
      if (!pointer.active) return;
      sphere.surge();
      repaint();
    };

    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) start();
      else stop();
    };

    resize();
    draw();
    if (!reduced) start();

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            resize();
            if (reduced) draw();
          })
        : null;
    if (ro) ro.observe(wrap);
    else window.addEventListener("resize", resize);

    // pause when the hero is scrolled away
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              visible = entries[0].isIntersecting && !document.hidden;
              if (visible) start();
              else stop();
            },
            { threshold: 0 }
          )
        : null;
    if (io) io.observe(wrap);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      stop();
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", resize);
      if (io) io.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <Div ref={wrapRef} aria-hidden="true">
      <AuroraShift>
        <Aurora />
      </AuroraShift>
      <Canvas ref={canvasRef} />
    </Div>
  );
};

export default HeroBgAnimation;
