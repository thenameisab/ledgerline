import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "edit-your-profile",
  title: "Edit your profile",
  summary: "Change your display name, job title, and avatar emoji from the sidebar.",
  group: "Team & access",
  role: "all",
  minutes: 2,
};

export default function Body() {
  return (
    <>
      <p>
        Your profile controls how you appear across Ledgerline — in the sidebar, the audit log, and on
        anything you create. Any signed-in user can edit their own.
      </p>

      <H2 id="steps">Update your profile</H2>
      <Steps>
        <Step title="Click your avatar at the bottom of the sidebar">
          A menu opens with <strong>Profile</strong>, <strong>Admin settings</strong> (admins
          only), and <strong>Sign out</strong>.
        </Step>
        <Step title="Choose “Profile”">
          The modal shows your <strong>Name</strong>, <strong>Job title</strong> (e.g. “Finance
          Lead” — shown under your name in the sidebar and on the Users page), and{" "}
          <strong>Avatar emoji</strong>.
        </Step>
        <Step title="Pick an emoji, or clear it">
          The searchable picker replaces your initials everywhere avatars appear — account-style
          dots in the sidebar, the users table, top-lists. Clearing it falls back to initials.
        </Step>
        <Step title="Save">
          Changes apply immediately. Your email is read-only — it is your sign-in identity.
        </Step>
      </Steps>

      <Callout variant="info">
        Admins can edit any user’s name, job title, and emoji via the pencil icon on Admin →
        Users. Roles are changed separately with the role dropdown.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/manage-roles-and-access", label: "Change a role or disable a user" },
          { href: "/help/guides/sign-in-to-ledgerline", label: "Sign in to Ledgerline" },
        ]}
      />
    </>
  );
}
