/**
 * The shortest password anyone can set (decision 27, CLAUDE.md). Checked when a
 * password is set or changed, never at sign-in, so passwords set before the
 * rule went up keep working.
 */
export const MIN_PASSWORD_LENGTH = 10;
