import { BACKUP_FORMAT, BACKUP_VERSION, MAX_BACKUP_BYTES, MAX_BACKUP_POSTS, validateBackup, validateBackupPost, backupPostKey, isExistingBackupPost } from "./backup.js";

let busy = false;
let refreshCurrentControls;
let latestStatus = "";
window.addEventListener("beforeunload", (event) => {
  if (busy) { event.preventDefault(); event.returnValue = ""; }
});

export function initBackupTools({ api, download, onRestored }) {
  const root = document.querySelector("#backup-tools");
  if (!root) return;
  const find = (id) => root.querySelector(`#${id}`);
  let pending = null;
  let pendingKeys = [];
  const status = (message) => { latestStatus = message; const target = document.querySelector("#backup-status"); if (target) target.textContent = message; };
  const controls = (disabled) => {
    root.querySelectorAll("button, input").forEach((el) => el.disabled = disabled);
    find("restore-backup").disabled = disabled || !pending;
    root.setAttribute("aria-busy", String(disabled));
  };
  refreshCurrentControls = () => controls(busy);
  controls(busy);
  if (latestStatus) status(latestStatus);

  find("export-json").addEventListener("click", async () => {
    if (busy) return;
    busy = true; controls(true);
    try {
      const includePhotos = find("backup-photos").checked;
      const info = await api("/api/backup/info");
      if (info.posts.length > MAX_BACKUP_POSTS) throw new Error(`A portable backup supports up to ${MAX_BACKUP_POSTS} captions`);
      const header = JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exported_at: new Date().toISOString(), templates: info.templates });
      const parts = [header.slice(0, -1) + ',"posts":['];
      let size = new Blob(parts).size;
      for (let i = 0; i < info.posts.length; i++) {
        status(`Preparing backup: caption ${i + 1} of ${info.posts.length}… Keep this tab open.`);
        const { post } = await api(includePhotos ? `/api/backup/posts/${info.posts[i].id}` : `/api/posts/${info.posts[i].id}`);
        if (post.updated_at !== info.posts[i].updated_at) throw new Error("A caption changed during export. Please start the backup again.");
        const selected = includePhotos ? post : { ...post, missing_images: post.images.length, images: [] };
        const chunk = (i ? "," : "") + JSON.stringify(validateBackupPost(selected));
        size += new Blob([chunk]).size;
        if (size + 2 > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 100 MB portable-file limit. Try a text-only backup; download photos separately from each caption.");
        parts.push(chunk);
      }
      parts.push("]}");
      download(`caption-studio-${new Date().toISOString().slice(0, 10)}.json`, new Blob(parts, { type: "application/json" }), "application/json");
      status(`Backup downloaded: ${info.posts.length} captions and ${info.templates.length} templates${includePhotos ? ", with photos" : ", without photos"}. Keep this private file somewhere safe.`);
    } catch (err) { status(`Backup not created: ${err.message}`); }
    finally { busy = false; refreshCurrentControls?.(); }
  });

  find("restore-file").addEventListener("change", async (event) => {
    if (busy) return;
    pending = null; pendingKeys = []; find("restore-preview").hidden = true;
    const file = event.target.files[0];
    if (!file) return controls(false);
    busy = true; controls(true); status("Validating the entire file. Nothing has been imported yet…");
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Choose a JSON backup no larger than 100 MB");
      let parsed;
      try { parsed = JSON.parse((await file.text()).replace(/^\uFEFF/, "")); }
      catch { throw new Error("This is not valid JSON. Choose a Caption Studio backup, not CSV or a photo."); }
      const validated = validateBackup(parsed);
      const info = await api("/api/backup/info");
      const keys = [];
      for (const post of validated.posts) keys.push(await backupPostKey(post));
      const seen = new Set();
      let skipped = 0;
      validated.posts.forEach((post, i) => {
        if (seen.has(keys[i]) || isExistingBackupPost(post, keys[i], info.posts)) skipped++;
        seen.add(keys[i]);
      });
      const names = new Set(info.templates.map((t) => t.name.toLowerCase()));
      const addedTemplates = validated.templates.filter((t) => !names.has(t.name.toLowerCase())).length;
      const photos = validated.posts.reduce((sum, p) => sum + p.images.length, 0);
      const missing = validated.posts.reduce((sum, p) => sum + p.missing_images, 0);
      find("restore-summary").textContent = `${validated.posts.length} captions (${skipped} already present or repeated), ${photos} bundled photos, ${validated.templates.length} templates (${addedTemplates} new). Existing captions are never replaced or deleted. Duplicate checks run again during import.`;
      find("restore-warning").textContent = `${validated.legacy ? "Older text-only backup. " : ""}${missing ? `${missing} photos are not in this file and cannot be restored. ` : ""}Unposted captions will be imported as unscheduled drafts unless you explicitly restore their schedules. Posted/archived history is preserved. Reminder-delivery history, app settings, Telegram credentials and device-local recovery drafts are not included.${info.templates.length + addedTemplates > 30 ? " Not enough template slots: uncheck templates or free up slots before restoring." : ""}`;
      find("restore-schedules").checked = false;
      find("restore-templates").checked = true;
      find("restore-preview").hidden = false;
      pending = validated; pendingKeys = keys;
      status("File validated. Review the preview and options, then confirm restore.");
    } catch (err) { status(`File rejected: ${err.message}. No captions or templates were changed.`); }
    finally { busy = false; refreshCurrentControls?.(); }
  });

  find("restore-backup").addEventListener("click", async () => {
    if (busy || !pending) return;
    const keepSchedule = find("restore-schedules").checked;
    const restoreTemplates = find("restore-templates").checked;
    const warning = keepSchedule ? "\nRestoring schedules can send due reminders, including reminders already sent on another database. Past schedules can trigger reminders on the next check." : "\nUnposted captions will remain unscheduled drafts, so they will not send reminders.";
    if (!confirm(`Add this backup to your studio? Existing captions and same-named templates will be kept.${warning}\nIf interrupted, select the same file again to safely resume.`)) return;
    busy = true; controls(true);
    let added = 0, skipped = 0, completed = false;
    try {
      const info = await api("/api/backup/info");
      if (restoreTemplates) {
        const names = new Set(info.templates.map((t) => t.name.toLowerCase()));
        if (info.templates.length + pending.templates.filter((t) => !names.has(t.name.toLowerCase())).length > 30) throw new Error("Not enough template slots. Uncheck template restore or delete unused templates first.");
      }
      const seen = new Set();
      for (let i = 0; i < pending.posts.length; i++) {
        status(`Restoring caption ${i + 1} of ${pending.posts.length}… (${added} added, ${skipped} skipped). Keep this tab open.`);
        if (seen.has(pendingKeys[i]) || isExistingBackupPost(pending.posts[i], pendingKeys[i], info.posts)) skipped++;
        else {
          const result = await api("/api/backup/restore-post", { method: "POST", body: { post: pending.posts[i], keep_schedule: keepSchedule } });
          result.skipped ? skipped++ : added++;
        }
        seen.add(pendingKeys[i]);
      }
      let templates = { added: 0, skipped: 0 };
      if (restoreTemplates) templates = await api("/api/backup/restore-templates", { method: "POST", body: { templates: pending.templates } });
      completed = true;
      status(`Restore complete: ${added} captions added, ${skipped} skipped; ${templates.added} templates added, ${templates.skipped} same-named templates kept. ${keepSchedule ? "Schedules restored; review upcoming reminders." : "Unposted captions were imported as unscheduled drafts."}`);
      pending = null; pendingKeys = [];
      find("restore-file").value = "";
    } catch (err) {
      status(`Restore stopped: ${err.message}. ${added} caption additions were confirmed and ${skipped} skipped in this attempt. Each caption and its photos are saved together. Retry this same file to continue without duplicating completed captions.`);
    } finally {
      busy = false; refreshCurrentControls?.();
      try { await onRestored(); }
      catch { if (completed) status("Restore completed, but the view could not refresh. Reload the app before reviewing your captions."); }
    }
  });
}
