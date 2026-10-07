import { permanentRedirect } from "next/navigation";

/**
 * The standalone /changelog handbook was retired in favour of the canonical
 * docs hub. This route now permanently redirects to /help/changelog.
 */
export default function ChangelogRedirect() {
  permanentRedirect("/help/changelog");
}
