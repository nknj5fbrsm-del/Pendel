export function createSnapshot(state, kineticEnergy, ball, isStill, dt) {
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
