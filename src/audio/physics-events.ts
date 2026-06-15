import type { BallCollisionEvents, DynamicsEvents } from "./types.js";

export type ExtendedDynamicsEvents = DynamicsEvents & {
  velocityPeak: boolean;
  energyJump: boolean;
  nearCollision: boolean;
  bob2QuadrantChange: boolean;
};

export class DynamicsEventTracker {
  private prevTotalSpeed = 0;
  private prevEnergy = 0;
  private prevBobDist = Number.POSITIVE_INFINITY;
  private prevBob2Quadrant = -1;
  private lastNearCollisionAt = -1;
  private readonly nearCollisionCooldown = 0.65;
  private readonly nearCollisionMaxDist = 0.38;

  reset(): void {
    this.prevTotalSpeed = 0;
    this.prevEnergy = 0;
    this.prevBobDist = Number.POSITIVE_INFINITY;
    this.prevBob2Quadrant = -1;
    this.lastNearCollisionAt = -1;
  }

  detect(
    now: number,
    prevState: { omega1: number; omega2: number; theta2: number },
    stepState: { omega1: number; omega2: number; theta2: number },
    prevGeom: { y1: number; y2: number; x1: number; x2: number },
    nextGeom: { y1: number; y2: number; x1: number; x2: number },
    kineticEnergy: number,
  ): ExtendedDynamicsEvents {
    const totalSpeed = Math.abs(stepState.omega1) + Math.abs(stepState.omega2);
    const bobDist = Math.hypot(nextGeom.x2 - nextGeom.x1, nextGeom.y2 - nextGeom.y1);
    const approaching = bobDist < this.prevBobDist - 0.012;
    this.prevBobDist = bobDist;

    const quadrant = Math.floor(((stepState.theta2 + Math.PI) % (Math.PI * 2)) / (Math.PI / 2));
    const quadrantChange =
      this.prevBob2Quadrant >= 0 && quadrant !== this.prevBob2Quadrant;
    this.prevBob2Quadrant = quadrant;

    const velocityPeak =
      totalSpeed > 2.8 &&
      this.prevTotalSpeed < 1.4 &&
      totalSpeed - this.prevTotalSpeed > 1.0;
    this.prevTotalSpeed = totalSpeed;

    const energyDelta = Math.abs(kineticEnergy - this.prevEnergy);
    const energyJump =
      this.prevEnergy > 0.12 &&
      energyDelta > Math.max(0.55, this.prevEnergy * 0.55);
    this.prevEnergy = kineticEnergy;

    let nearCollision = false;
    if (
      bobDist < this.nearCollisionMaxDist &&
      approaching &&
      now - this.lastNearCollisionAt > this.nearCollisionCooldown
    ) {
      nearCollision = true;
      this.lastNearCollisionAt = now;
    }

    return {
      bob1Cross: prevGeom.y1 * nextGeom.y1 < 0,
      bob2Cross: prevGeom.y2 * nextGeom.y2 < 0,
      omega1Flip: prevState.omega1 * stepState.omega1 < 0,
      omega2Flip: prevState.omega2 * stepState.omega2 < 0,
      velocityPeak,
      energyJump,
      nearCollision,
      bob2QuadrantChange: quadrantChange,
    };
  }
}

export type { BallCollisionEvents };
