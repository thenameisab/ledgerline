// The landing-page gate. After the visitor submits the Tally form, the page
// calls /api/demo-access, which sets this cookie. The middleware sends
// signed-out visitors without it back to the form. It records interest; it is
// not a security boundary. The app's sign-in and server-side checks still apply.

export const DEMO_ACCESS_COOKIE = "ll_demo";
export const DEMO_ACCESS_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

/** The Tally form embedded on the landing page. */
export const TALLY_FORM_ID = "eqlzaE";
