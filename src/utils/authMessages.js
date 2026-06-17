const ROLE_PORTAL_LABEL = {
  event_organizer: "Organizer",
  artist: "Artist",
  admin: "Admin",
};

const WRONG_ACCOUNT_TYPE = "WRONG_ACCOUNT_TYPE";

/** Roles shown on the event-organizer login page (not admin). */
const ORGANIZER_PORTAL_ROLES = ["event_organizer", "artist"];

const wrongPortalMessage = (actualRole, attemptedRole) => {
  const actual = ROLE_PORTAL_LABEL[actualRole] || actualRole;
  const attempted = ROLE_PORTAL_LABEL[attemptedRole] || attemptedRole;
  return `This account is registered as an ${actual}. Please switch to the ${actual} tab to sign in, not ${attempted}.`;
};

/**
 * When signing in on the organizer portal, only suggest Organizer vs Artist —
 * ignore admin (or other) accounts that may share the same email.
 */
const organizerPortalWrongTabMessage = (users, attemptedRole) => {
  const portalUsers = (users || []).filter((user) =>
    ORGANIZER_PORTAL_ROLES.includes(user.role)
  );

  if (!portalUsers.length) {
    return null;
  }

  const alternate = portalUsers.find((user) => user.role !== attemptedRole);
  if (!alternate) {
    return null;
  }

  return wrongPortalMessage(alternate.role, attemptedRole);
};

module.exports = {
  WRONG_ACCOUNT_TYPE,
  wrongPortalMessage,
  organizerPortalWrongTabMessage,
};
