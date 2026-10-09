/**
 * The attribution model for member joins: what a guild's invite state looks
 * like at a point in time, and which invite or vanity URL gained a use
 * between two such snapshots. Pure data and diffing only, so the event
 * bridge, the invites feature, and logging can share it.
 */

/** One tracked invite's uses and inviter at snapshot time. */
export type TrackedInvite = {
  uses: number;
  inviterId: string | null;
};

/**
 * One guild's invite state at a point in time: every tracked invite by code,
 * plus the vanity URL (`null` when the guild has none or the fetch failed).
 */
export type InviteSnapshot = {
  invites: Map<string, TrackedInvite>;
  vanity: { code: string; uses: number } | null;
};

/**
 * Where a member's join came from, resolved by diffing the guild's invite
 * snapshot around the join. A `null` source means nothing gained a use: the
 * OAuth widget, an expired single-use invite, or a guild the bot cannot
 * track.
 */
export type JoinSource =
  /** An invite code whose uses grew, with the member whose invite it is. */
  | { kind: "invite"; code: string; inviterId: string | null }
  /** The guild's vanity URL, whose uses grew instead. */
  | { kind: "vanity"; code: string };

/** A snapshot with nothing tracked, the state an untrackable guild keeps. */
export function emptySnapshot(): InviteSnapshot {
  return { invites: new Map(), vanity: null };
}

/**
 * The source that gained a use between the two snapshots: the first invite
 * whose uses grew, or the vanity URL when only that grew. `null` when
 * neither grew.
 *
 * An invite wins when both grew, since a join that used a code cannot use
 * the vanity URL at the same time. Several invites growing at once means
 * several joins arrived between the fetches, and the member's own join
 * cannot be told apart from the others.
 */
export function findJoinSource(before: InviteSnapshot, after: InviteSnapshot): JoinSource | null {
  for (const [code, invite] of after.invites) {
    if (invite.uses > (before.invites.get(code)?.uses ?? 0)) {
      return { kind: "invite", code, inviterId: invite.inviterId };
    }
  }
  if (after.vanity && before.vanity && after.vanity.uses > before.vanity.uses) {
    return { kind: "vanity", code: after.vanity.code };
  }
  return null;
}
