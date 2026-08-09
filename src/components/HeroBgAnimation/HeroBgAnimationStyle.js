import styled, { keyframes } from "styled-components";

const float = keyframes`
  0%   { transform: translate3d(0, 0, 0) rotate(0deg); }
  50%  { transform: translate3d(0, -18px, 0) rotate(2.5deg); }
  100% { transform: translate3d(0, 0, 0) rotate(0deg); }
`;

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

/** Particle constellation. Sits behind everything. */
export const Canvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
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

/** The geometric circuit, parked on the right like the original. */
export const Circuit = styled.div`
  position: absolute;
  top: 50%;
  right: 4%;
  width: 600px;
  height: 500px;
  margin-top: -250px;
  animation: ${float} 12s ease-in-out infinite;
  will-change: transform;

  /* follows the cursor a little; --px/--py are set from JS */
  transform: translate3d(
    calc(var(--px, 0) * 18px),
    calc(var(--py, 0) * 18px),
    0
  );
  transition: transform 400ms cubic-bezier(0.22, 1, 0.36, 1);

  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  @media (max-width: 960px) {
    right: 50%;
    width: 420px;
    height: 380px;
    margin-right: -210px;
    margin-top: -190px;
    opacity: 0.75;
  }

  @media (max-width: 640px) {
    width: 320px;
    height: 300px;
    margin-right: -160px;
    margin-top: -150px;
    opacity: 0.6;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }
`;
