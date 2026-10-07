import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { config } from "@/lib/config";
import { findUserByEmail } from "@/lib/repos/users";

// Demo auth. Sign-in is a dev-only
// Credentials provider that simply matches a seeded user by email (no
// password). The login screen offers one-click "Admin" / "Member" buttons so
// role-based behavior is demoable. Everything downstream (role, id) is still
// sourced from the `users` table via the jwt callback.
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: config.auth.sessionSecret,
  trustHost: true,
  basePath: "/api/auth",
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: { email: { label: "Email", type: "text" } },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        if (!email) return null;
        const user = await findUserByEmail(email);
        if (!user || user.status !== "active") return null;
        return { id: String(user.id), email: user.email, name: user.display_name };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in NextAuth passes the provider profile as `user`.
      // We re-key on email since our `users` row is the source of truth.
      const email = token.email ?? user?.email;
      if (email) {
        const dbUser = await findUserByEmail(email);
        if (dbUser) {
          (token as any).uid = dbUser.id;
          (token as any).role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as any;
      const u = session.user as any;
      if (t.uid) u.id = t.uid;
      if (t.role) u.role = t.role;
      return session;
    },
  },
});
