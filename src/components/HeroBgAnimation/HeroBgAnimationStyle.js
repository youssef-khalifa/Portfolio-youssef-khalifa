import styled, { keyframes } from "styled-components";

const drift = keyframes`
  0%   { transform: translate3d(-6%, -4%, 0) scale(1); }
  50%  { transform: translate3d(6%, 5%, 0) scale(1.12); }
  100% { transform: translate3d(-6%, -4%, 0) scale(1); }
`;

/** Full-bleed stage. The parent (HeroBg) is already absolutely positioned. */
export const Div = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
`;

/** Particle constellation and circuit mark share this surface. */
export const Canvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
`;

/**
 * Carries the cursor parallax for the colour washes. It has to be a separate
 * element from Aurora: a keyframe animation and a static rule both writing
 * `transform` don't compose — the animation simply wins — so the two motions
 * are split across two nodes.
 */
export const AuroraShift = styled.div`
  position: absolute;
  inset: 0;
  transform: translate3d(
    calc(var(--px, 0) * 14px),
    calc(var(--py, 0) * 14px),
    0
  );
  transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/** Two slow-moving colour washes that give the flat background some depth. */
export const Aurora = styled.div`
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(
      38% 44% at 78% 32%,
      rgba(133, 76, 230, 0.28) 0%,
      rgba(133, 76, 230, 0) 70%
    ),
    radial-gradient(
      32% 38% at 22% 72%,
      rgba(19, 173, 199, 0.16) 0%,
      rgba(19, 173, 199, 0) 70%
    );
  filter: blur(18px);
  animation: ${drift} 26s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
