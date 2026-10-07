/** Serializable view models passed from server pages to client components. */

export type CatalogView = {
  organizations: { id: string; name: string }[];
  projects: { id: string; name: string; color: string; organizationId: string; isArchived: boolean }[];
  tasks: { id: string; projectId: string; name: string; isCompleted: boolean }[];
  tags: { id: string; name: string; color: string }[];
  /** Projects the caller may put new work on; null = unrestricted (admins). Members still *see* every project name. */
  allowedProjectIds: string[] | null;
};

export type EntryView = {
  id: string;
  description: string;
  projectId: string | null;
  taskId: string | null;
  tagIds: string[];
  isBillable: boolean;
  /** ISO instants. */
  startedAt: string;
  endedAt: string | null;
  /** Local (user's time zone) wall-clock parts, ready for form fields. */
  date: string;
  startTime: string;
  endTime: string | null;
  /** Local day the entry ended; differs from `date` when it crosses midnight. Null while running. */
  endDate: string | null;
  /** Whole seconds for finished entries; null while running. */
  durationSeconds: number | null;
};
