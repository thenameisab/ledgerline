import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "edit-an-account-profile",
  title: "Edit an account's profile",
  summary: "Update an account's name, legal entity, owners, logo, and MSA details.",
  group: "Daily work",
  role: "all",
  minutes: 3,
};

export default function Body() {
  return (
    <>
      <p>
        An account&rsquo;s own details — name, legal entity, website, owners, logo, and MSA — live
        on the <strong>Profile</strong> tab, next to Overview. Admins and editors can make changes;
        everyone else sees Overview only.
      </p>

      <Figure
        src="/help/shots/account-profile-edit.png"
        alt="The account Profile tab with name, legal name, owners, logo, and MSA fields"
        caption="The Profile tab: identity fields, ownership, logo, and MSA."
      />

      <H2 id="steps">Update the profile</H2>
      <Steps>
        <Step title="Open the account, then the Profile tab">
          From Overview, click <strong>Profile</strong> in the tab bar.
        </Step>
        <Step title="Edit identity fields">
          Name, account ID (letters, numbers, dot and dash — must be unique), legal name, and
          website. The website enables logo.dev lookups below.
        </Step>
        <Step title="Set CS and Sales owners">
          Pick from the searchable Combobox for each team, or leave unassigned.
        </Step>
        <Step title="Set the logo">
          Drag an image onto the drop zone, click Upload, or click "Fetch from logo.dev" once a
          website is set.
        </Step>
        <Step title="Add the MSA">
          Paste a link to the signed Master Service Agreement (Drive, DocuSign, etc.), then its
          start date and, if it has one, an end date. Leave the end date blank for open-ended
          terms.
        </Step>
        <Step title="Save">
          Changes apply immediately. If the MSA is missing and the account has over a week of
          logged usage, the missing-MSA flag on Overview clears once it&rsquo;s filled in.
        </Step>
      </Steps>

      <Callout variant="info">
        The missing-MSA flag exists to catch groups that started billing without paperwork on
        file — it&rsquo;s a nudge, not a block. There&rsquo;s no enforcement tying it to invoicing.
      </Callout>

      <Related
        links={[
          { href: "/help/features/account-profile", label: "Account profile" },
          { href: "/help/guides/investigate-an-account", label: "Investigate an account" },
          { href: "/help/guides/manage-roles-and-access", label: "Change a role or disable a user" },
        ]}
      />
    </>
  );
}
