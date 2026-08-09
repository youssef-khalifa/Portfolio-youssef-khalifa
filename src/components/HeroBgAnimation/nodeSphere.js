/**
 * The hero's focal animation: a large node mesh wrapped on a sphere.
 *
 * This replaces the old geometric circuit mark, whose dots ran along fixed
 * SMIL timers and ignored the visitor entirely. It is built from the same
 * vocabulary as the background constellation — dots, link threads, a few
 * brighter hubs — just scaled up and given depth, so the two read as one
 * system rather than two unrelated effects.
 *
 * Everything about it answers to the pointer: the mesh deforms away from the
 * cursor like a membrane, nearby nodes brighten and thread to it, the spin and
 * tilt follow it, and a click sends a ripple out across the surface.
 */

const PALETTE = [
  [148, 93, 214], // #945DD6
  [133, 76, 230], // #854CE6
  [19, 173, 199], // #13ADC7
];

const NODE_COUNT = 154;
const LINK_3D = 0.34; // unit-sphere distance below which two nodes link
const FOV = 3.1; // perspective strength; larger is flatter
const CURSOR_R = 210; // px of pointer influence, in screen space
const PUSH_MAX = 30; // px the mesh gives under the cursor
const SPIN = 0.16; // idle rotation, radians per second
const RIPPLE_SPEED = 560; // px per second
const RIPPLE_BAND = 70; // px thickness of the ripple ring

/** Fibonacci lattice — the most even way to scatter N points on a sphere. */
const buildNodes = () => {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const nodes = new Array(NODE_COUNT);

  for (let i = 0; i < NODE_COUNT; i += 1) {
    const y = 1 - (i / (NODE_COUNT - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;

    nodes[i] = {
      x: Math.cos(theta) * ring,
      y,
      z: Math.sin(theta) * ring,
      color: PALETTE[i % PALETTE.length],
      hub: Math.random() < 0.13,
      r: 1.1 + Math.random() * 1.0,
      push: 0,
      pdx: 0, // last push direction, kept so the node can ease back
      pdy: 0,
      flare: 0,
    };
  }
  return nodes;
};

/**
 * The mesh is rigid, so which nodes link never changes — the pairs are worked
 * out once here instead of being re-tested every frame.
 */
const buildEdges = (nodes) => {
  const edges = [];
  const limit = LINK_3D * LINK_3D;

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dz = nodes[i].z - nodes[j].z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= limit) edges.push(i, j);
    }
  }
  return edges;
};

/** Pre-rendered glow, so hubs cost a drawImage instead of a shadowBlur. */
const buildGlow = () => {
  const c = document.createElement("canvas");
  const R = 26;
  c.width = R * 2;
  c.height = R * 2;

  const g = c.getContext("2d");
  const grad = g.createRadialGradient(R, R, 0, R, R, R);
  grad.addColorStop(0, "rgba(178,132,255,0.62)");
  grad.addColorStop(0.4, "rgba(150,100,240,0.18)");
  grad.addColorStop(1, "rgba(148,93,214,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, R * 2, R * 2);

  return { sprite: c, R };
};

export const createNodeSphere = () => {
  const nodes = buildNodes();
  const edges = buildEdges(nodes);
  const glow = buildGlow();

  // per-frame projection results, kept flat to avoid churning objects
  const px = new Float32Array(NODE_COUNT);
  const py = new Float32Array(NODE_COUNT);
  const pd = new Float32Array(NODE_COUNT); // depth, 0 = far, 1 = near
  const ps = new Float32Array(NODE_COUNT); // perspective scale

  let cx = 0;
  let cy = 0;
  let radius = 0;
  let opacity = 1;

  let rotY = 0.6;
  let rotX = 0;
  let reduced = false;

  const pointer = { x: -9999, y: -9999, nx: 0, ny: 0, active: false };
  const ripples = [];

  const project = () => {
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);

    for (let i = 0; i < NODE_COUNT; i += 1) {
      const n = nodes[i];

      const x1 = n.x * cosY + n.z * sinY;
      const z1 = n.z * cosY - n.x * sinY;
      const y2 = n.y * cosX - z1 * sinX;
      const z2 = z1 * cosX + n.y * sinX;

      const persp = FOV / (FOV + z2);
      px[i] = cx + x1 * radius * persp;
      py[i] = cy + y2 * radius * persp;
      pd[i] = (z2 + 1) * 0.5;
      ps[i] = persp;
    }
  };

  /** Cursor push and ripple flare, applied on top of the projection. */
  const interact = (dt) => {
    const ease = Math.min(1, dt * 7);

    for (let i = 0; i < NODE_COUNT; i += 1) {
      const n = nodes[i];
      let target = 0;

      if (pointer.active) {
        const dx = px[i] - pointer.x;
        const dy = py[i] - pointer.y;
        const d = Math.hypot(dx, dy);

        if (d < CURSOR_R && d > 0.01) {
          const near = 1 - d / CURSOR_R;
          target = near * PUSH_MAX;
          n.flare = Math.max(n.flare, near);
          n.pdx = dx / d;
          n.pdy = dy / d;
        }
      }

      n.push += (target - n.push) * ease;

      // applied whatever the cursor is doing now, otherwise a node leaving the
      // radius would snap home instead of easing back
      if (n.push > 0.01) {
        px[i] += n.pdx * n.push;
        py[i] += n.pdy * n.push;
      }

      for (let k = 0; k < ripples.length; k += 1) {
        const rp = ripples[k];
        const ring = rp.age * RIPPLE_SPEED;
        const d = Math.hypot(px[i] - rp.x, py[i] - rp.y);
        const off = Math.abs(d - ring);
        if (off < RIPPLE_BAND) {
          n.flare = Math.max(n.flare, (1 - off / RIPPLE_BAND) * rp.strength);
        }
      }

      n.flare = Math.max(0, n.flare - dt * 1.6);
    }
  };

  const layout = (width, height) => {
    let r = Math.min(width * 0.31, height * 0.46);

    if (width <= 960) {
      r = Math.min(width * 0.42, height * 0.34);
      cx = width * 0.5;
      opacity = width <= 640 ? 0.62 : 0.78;
    } else {
      cx = width - r - width * 0.06;
      opacity = 1;
    }

    radius = Math.max(110, Math.min(r, 360));
    if (width > 960) cx = width - radius - width * 0.06;
    cy = height * 0.5;

    project();
  };

  const setPointer = (x, y, active, nx, ny) => {
    pointer.x = x;
    pointer.y = y;
    pointer.nx = nx;
    pointer.ny = ny;
    pointer.active = active;
  };

  const setReducedMotion = (value) => {
    reduced = value;
  };

  const surge = () => {
    if (!pointer.active) return;
    ripples.push({ x: pointer.x, y: pointer.y, age: 0, strength: 1 });
    if (ripples.length > 4) ripples.shift();
  };

  const update = (dt) => {
    if (!reduced) {
      // spin drifts with how far the cursor sits to either side
      rotY += (SPIN + (pointer.active ? pointer.nx * 0.55 : 0)) * dt;
      const tilt = pointer.active ? -pointer.ny * 0.62 : 0;
      rotX += (tilt - rotX) * Math.min(1, dt * 2.2);
    }

    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      ripples[i].age += dt;
      if (ripples[i].age * RIPPLE_SPEED > radius * 3.2) ripples.splice(i, 1);
    }

    project();
    interact(dt);
  };

  const draw = (ctx) => {
    if (!radius) return;

    ctx.save();
    ctx.globalAlpha = opacity;

    // a soft bed of light so the mesh has some presence against the page
    const bed = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
    bed.addColorStop(0, "rgba(133,76,230,0.16)");
    bed.addColorStop(0.6, "rgba(133,76,230,0.05)");
    bed.addColorStop(1, "rgba(133,76,230,0)");
    ctx.fillStyle = bed;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // --- link threads -------------------------------------------------------
    ctx.lineWidth = 0.8;
    for (let e = 0; e < edges.length; e += 2) {
      const i = edges[e];
      const j = edges[e + 1];

      const depth = (pd[i] + pd[j]) * 0.5;
      const lit = Math.max(nodes[i].flare, nodes[j].flare);
      const a = (0.06 + depth * 0.34) * (1 + lit * 1.6);

      if (lit > 0.02) {
        // lerp the thread toward the cursor cyan the field already uses.
        // Channels are rounded because an unparseable colour string leaves the
        // previous strokeStyle in place rather than erroring.
        const k = 1 - lit;
        ctx.strokeStyle = `rgba(${Math.round(19 + 129 * k)},${Math.round(
          173 - 80 * k
        )},${Math.round(199 + 15 * k)},${Math.min(0.9, a).toFixed(3)})`;
      } else {
        ctx.strokeStyle = `rgba(148,93,214,${a.toFixed(3)})`;
      }
      ctx.beginPath();
      ctx.moveTo(px[i], py[i]);
      ctx.lineTo(px[j], py[j]);
      ctx.stroke();
    }

    // --- threads to the cursor, same language as the background field -------
    if (pointer.active) {
      ctx.lineWidth = 0.9;
      for (let i = 0; i < NODE_COUNT; i += 1) {
        if (pd[i] < 0.35) continue; // only the face turned toward the viewer
        const d = Math.hypot(px[i] - pointer.x, py[i] - pointer.y);
        if (d >= CURSOR_R) continue;
        const a = (1 - d / CURSOR_R) * 0.5;
        ctx.strokeStyle = `rgba(19,173,199,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(px[i], py[i]);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
      }
    }

    // --- nodes --------------------------------------------------------------
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < NODE_COUNT; i += 1) {
      const n = nodes[i];
      if (!n.hub && n.flare < 0.05) continue;
      const size = glow.R * ps[i] * (n.hub ? 1 : 0.7) * (1 + n.flare * 0.8);
      ctx.globalAlpha = opacity * (0.25 + pd[i] * 0.75);
      ctx.drawImage(glow.sprite, px[i] - size, py[i] - size, size * 2, size * 2);
    }
    ctx.restore();

    ctx.globalAlpha = opacity;
    for (let i = 0; i < NODE_COUNT; i += 1) {
      const n = nodes[i];
      const [r, g, b] = n.color;
      const a = (0.2 + pd[i] * 0.7) * (1 + n.flare * 0.9);
      const size = n.r * ps[i] * (n.hub ? 1.7 : 1) * (1 + n.flare * 0.7);

      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px[i], py[i], size, 0, Math.PI * 2);
      ctx.fill();

      if (n.flare > 0.25) {
        ctx.fillStyle = `rgba(255,255,255,${(n.flare * 0.7).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px[i], py[i], size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  return { layout, setPointer, setReducedMotion, surge, update, draw };
};

export default createNodeSphere;
