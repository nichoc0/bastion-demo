// Demo mode is BUILD-TIME only. It is on only when the build sets VITE_DEMO=1
// (the dedicated bastion-demo deployment) or the local-dev bypass is set. It is
// deliberately NOT controllable at runtime (no localStorage / query flag) so it
// can never weaken auth on the production app: a visitor cannot flip it. In demo
// mode the sign-in gate is bypassed and the Cortex tab + Past Runs demo data are
// shown; in the normal app it is always off.
export function isDemoMode() {
  return import.meta.env.VITE_DEMO === '1' || import.meta.env.VITE_BYPASS_DEMO_GATE === '1';
}

// Where the "Switch to demo mode" action sends you: the no-auth demo deployment.
export const DEMO_URL = 'https://demo.trybastion.ai';
