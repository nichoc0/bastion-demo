// Clerk shim — the dashboard does not use auth.
// staging.demo's Clerk pk_live key is domain-locked and 400s on localhost,
// which blanks the whole app. We alias `@clerk/clerk-react` to this shim in
// vite.config so every component keeps its imports unchanged but resolves to
// these no-ops, rendering the dashboard as a signed-in demo operator.

const DEMO_USER = {
  id: 'user_demo',
  fullName: 'Demo Operator',
  firstName: 'Demo',
  primaryEmailAddress: { emailAddress: 'demo@bastion.ai' },
  imageUrl: '',
};
const DEMO_ORG = { id: 'org_bastion', name: 'Bastion', slug: 'bastion' };

export function ClerkProvider({ children }) { return children; }

export function useUser() {
  return { isLoaded: true, isSignedIn: true, user: DEMO_USER };
}
export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: DEMO_USER.id,
    orgId: DEMO_ORG.id,
    getToken: async () => 'demo-token',
    signOut: async () => {},
  };
}
export function useOrganization(opts = {}) {
  const out = { isLoaded: true, organization: DEMO_ORG, membership: { role: 'admin' } };
  if (opts && opts.invitations) out.invitations = { data: [], isLoading: false };
  return out;
}
export function useOrganizationList() {
  return {
    isLoaded: true,
    userMemberships: { data: [{ organization: DEMO_ORG }], isLoading: false },
    createOrganization: async () => DEMO_ORG,
    setActive: async () => {},
  };
}
export function useClerk() {
  return { signOut: async () => {}, openSignIn: () => {}, openSignUp: () => {} };
}

export function SignedIn({ children }) { return children; }
export function SignedOut() { return null; }
export function SignIn() { return null; }
export function SignUp() { return null; }
export function RedirectToSignIn() { return null; }

export function OrganizationSwitcher() {
  return (
    <div className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-none text-[12px] font-semibold text-slate-600 dark:text-slate-300">
      {DEMO_ORG.name}
    </div>
  );
}
export function UserButton() {
  return (
    <div className="w-8 h-8 rounded-none border border-slate-300 dark:border-slate-700 bg-slate-900 text-white grid place-items-center text-[11px] font-bold">
      D
    </div>
  );
}

export default {
  ClerkProvider, useUser, useAuth, useOrganization, useOrganizationList, useClerk,
  SignedIn, SignedOut, SignIn, SignUp, RedirectToSignIn, OrganizationSwitcher, UserButton,
};
