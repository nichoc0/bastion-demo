import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk-real';

// Demo-access gate — REAL Clerk as a self-contained island (the dashboard
// underneath keeps the @clerk/clerk-react demo-operator shim, 40+ call sites
// untouched).
//
// Clerk primary domain is now trybastion.ai (Frontend API clerk.trybastion.ai),
// so the app on demo.trybastion.ai is a subdomain of the primary — the session
// cookie is shared on .trybastion.ai and Clerk works directly. No satellite.
// demo.trybastion.ai must be listed under Clerk → Domains → Allowed subdomains.
//
// Publishable key encodes the Frontend API host (clerk.trybastion.ai). Override
// via VITE_CLERK_PUBLISHABLE_KEY if Clerk rotates it.
//
// Local-dev bypass: VITE_BYPASS_DEMO_GATE=1 (.env.development.local).

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  || 'pk_live_Y2xlcmsudHJ5YmFzdGlvbi5haSQ';

export default function DemoGate({ children }) {
  // Build-time bypass only: the dedicated demo deployment (VITE_DEMO=1) and the
  // local-dev bypass. Never runtime-controllable, so prod auth cannot be flipped.
  if (import.meta.env.VITE_BYPASS_DEMO_GATE === '1' || import.meta.env.VITE_DEMO === '1') return children;

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <SignInScreen />
      </SignedOut>
    </ClerkProvider>
  );
}

function SignInScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#060B14] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-black dark:bg-slate-950 border border-slate-300 dark:border-slate-700 flex items-center justify-center mb-4">
            <img
              src={`${import.meta.env.BASE_URL || '/'}bastion-logo.png`}
              alt="Bastion"
              className="w-7 h-7 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Bastion Demo Access
          </h1>
        </div>

        <SignIn
          routing="hash"
          forceRedirectUrl={typeof window !== 'undefined' ? window.location.href : undefined}
        />

        <p className="mt-6 text-[10px] text-slate-400 dark:text-slate-500 text-center">
          Don&apos;t have access? Email{' '}
          <a
            href="mailto:team@trybastion.ai"
            className="text-blue-600 dark:text-blue-400 underline underline-offset-2"
          >
            team@trybastion.ai
          </a>
          .
        </p>
        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 text-center">
          Bastion · Agentic Risk Infrastructure
        </p>
      </div>
    </div>
  );
}
