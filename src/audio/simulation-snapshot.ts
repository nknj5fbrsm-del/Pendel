export type SimulationSnapshot = {
  theta1: number;
  theta2: number;
  omega1: number;
  omega2: number;
  kineticEnergy: number;
  totalSpeed: number;
  ballX: number;
  ballY: number;
  ballSpeed: number;
  isStill: boolean;
  dt: number;
};

export function createSnapshot(
  state: { theta1: number; theta2: number; omega1: number; omega2: number },
  kineticEnergy: number,
  ball: { x: number; y: number; speed: number },
  isStill: boolean,
  dt: number,
): SimulationSnapshot {
  return {
    theta1: state.theta1,
    theta2: state.theta2,
    omega1: state.omega1,
    omega2: state.omega2,
    kineticEnergy,
    totalSpeed: Math.abs(state.omega1) + Math.abs(state.omega2),
    ballX: ball.x,
    ballY: ball.y,
    ballSpeed: ball.speed,
    isStill,
    dt,
  };
}
