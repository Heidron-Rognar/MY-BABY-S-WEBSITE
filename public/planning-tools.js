// Pure, testable helpers for device-local recovery and local-calendar moves.
export const RECOVERY_KEY = "cs-editor-recovery-v1";
export const draftKey = (postId) => postId ? String(postId) : "new";

export function cleanDraft(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const text = (key, max) => typeof value[key] === "string" ? value[key].slice(0, max) : "";
  const postId = Number.isSafeInteger(value.postId) && value.postId > 0 ? value.postId : null;
  return {
    postId, sourceUpdatedAt: text("sourceUpdatedAt", 40), updatedAt: text("updatedAt", 40),
    title: text("title", 200), caption: text("caption", 10000), notes: text("notes", 5000),
    date: /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : "",
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) ? value.time : "",
    content_type: text("content_type", 60),
    platforms: Array.isArray(value.platforms) ? value.platforms.filter((p) => typeof p === "string").slice(0, 10).map((p) => p.slice(0, 40)) : [],
    status: ["idea", "draft", "ready", "posted"].includes(value.status) ? value.status : "draft",
    reminder_offsets: Array.isArray(value.reminder_offsets) ? [...new Set(value.reminder_offsets.filter((n) => Number.isInteger(n) && n >= 0 && n <= 20160))].slice(0, 8) : null,
    imagesNotRecovered: Boolean(value.imagesNotRecovered),
  };
}

export function readDrafts(storage) {
  try {
    const data = JSON.parse(storage.getItem(RECOVERY_KEY) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const result = {};
    for (const value of Object.values(data).slice(0, 50)) {
      const draft = cleanDraft(value);
      if (draft) result[draftKey(draft.postId)] = draft;
    }
    return result;
  } catch { return {}; }
}

export function writeDrafts(storage, drafts) {
  try {
    if (Object.keys(drafts).length) storage.setItem(RECOVERY_KEY, JSON.stringify(drafts));
    else storage.removeItem(RECOVERY_KEY);
    return true;
  } catch { return false; }
}

// Preserve wall-clock posting time in the device timezone, not a fixed UTC offset.
// Reject nonexistent DST times rather than silently moving a caption by an hour.
export function moveToLocalDay(scheduledAt, day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Choose a valid calendar day");
  if (typeof scheduledAt !== "string" || !scheduledAt) throw new Error("This caption has no valid posting time");
  const original = new Date(scheduledAt);
  if (!Number.isFinite(original.getTime())) throw new Error("This caption has no valid posting time");
  const [year, month, date] = day.split("-").map(Number);
  const moved = new Date(year, month - 1, date, original.getHours(), original.getMinutes(), original.getSeconds(), original.getMilliseconds());
  if (moved.getFullYear() !== year || moved.getMonth() !== month - 1 || moved.getDate() !== date || moved.getHours() !== original.getHours() || moved.getMinutes() !== original.getMinutes()) {
    throw new Error("That posting time does not exist on this day. Choose a time in the editor.");
  }
  return moved.toISOString();
}
