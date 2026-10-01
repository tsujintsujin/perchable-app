/** What a report points at; matches the `reports_target_type_check` values. */
export type ReportTargetType = "profile" | "comment" | "dm_message" | "collection_item";

/** The content being reported and the user who owns it. */
export type ReportTarget = {
  type: ReportTargetType;
  id: string;
  ownerId: string;
};

/** One row of the Blocked users list: the blocked user's public profile fields. */
export type BlockedUser = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  usertag: string | null;
};
