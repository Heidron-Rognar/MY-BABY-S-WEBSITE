// The default deliberately leaves every theme's original icon treatment intact.
export const DEFAULT_BRAND_ICON = Object.freeze({ mode: "theme" });
export const MAX_ICON_DATA_LENGTH = 100000;

export function validateBrandIcon(icon) {
  if (!icon || typeof icon !== "object" || Array.isArray(icon)) throw new Error("Choose a theme icon, emoji, or uploaded image");
  if (icon.mode === "theme") return { mode: "theme" };
  if (icon.mode === "emoji") {
    const value = typeof icon.value === "string" ? icon.value.trim() : "";
    if (!value || value.length > 40) throw new Error("Enter one emoji, such as 🐚, 🍵, or ✨");
    const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)];
    if (!value || value.length > 40 || segments.length !== 1 || /\p{Cc}/u.test(value) || !(/\p{Extended_Pictographic}/u.test(value) || /^\p{Regional_Indicator}{2}$/u.test(value) || /^[#*0-9]\uFE0F?\u20E3$/u.test(value))) {
      throw new Error("Enter one emoji, such as 🐚, 🍵, or ✨");
    }
    return { mode: "emoji", value };
  }
  if (icon.mode === "image") {
    const value = icon.value;
    if (typeof value !== "string" || value.length > MAX_ICON_DATA_LENGTH || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("Upload an image using the image picker (PNG icon, at most 100 KB encoded)");
    const base64 = value.slice("data:image/png;base64,".length);
    if (base64.length % 4) throw new Error("The icon image is invalid");
    const header = atob(base64.slice(0, 44));
    const integer = (offset) => ((header.charCodeAt(offset) * 0x1000000) + (header.charCodeAt(offset + 1) << 16) + (header.charCodeAt(offset + 2) << 8) + header.charCodeAt(offset + 3));
    if (header.length < 33 || !header.startsWith("\x89PNG\r\n\x1a\n") || header.slice(12, 16) !== "IHDR" || integer(16) < 1 || integer(16) > 128 || integer(20) < 1 || integer(20) > 128) throw new Error("Upload a valid image through the image picker (resized to 128 pixels)");
    return { mode: "image", value };
  }
  throw new Error("Unknown title-icon option");
}

export function normalizeBrandIcon(icon) {
  try { return validateBrandIcon(icon); }
  catch { return { mode: "theme" }; }
}

export function applyBrandIcon(element, setting) {
  const icon = normalizeBrandIcon(setting);
  element.replaceChildren();
  if (icon.mode === "theme") {
    delete element.dataset.iconMode;
    element.textContent = "✍️";
    return;
  }
  element.dataset.iconMode = icon.mode;
  if (icon.mode === "emoji") element.textContent = icon.value;
  else {
    const image = element.ownerDocument.createElement("img");
    image.src = icon.value;
    image.alt = ""; // Decorative: the adjacent studio name is the accessible name.
    image.draggable = false;
    element.append(image);
  }
}

export async function prepareBrandImage(file) {
  if (!file || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) throw new Error("Choose a PNG, JPG, WebP, or GIF image. SVG and other files are not supported.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Choose an image smaller than 8 MB");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("The image could not be read");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot resize images");
    const scale = 128 / Math.max(image.naturalWidth, image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, (128 - width) / 2, (128 - height) / 2, width, height);
    return validateBrandIcon({ mode: "image", value: canvas.toDataURL("image/png") }).value;
  } finally { URL.revokeObjectURL(url); }
}

export function initBrandIconControls({ setting, save }) {
  const root = document.querySelector("#brand-icon-controls");
  if (!root) return;
  const find = (id) => root.querySelector(`#${id}`);
  const saved = normalizeBrandIcon(setting);
  let imageData = saved.mode === "image" ? saved.value : "";
  let busy = false;
  const status = (text) => { find("brand-icon-status").textContent = text; };
  find("brand-icon-mode").value = saved.mode;
  find("brand-icon-emoji").value = saved.mode === "emoji" ? saved.value : "✍️";
  const current = () => validateBrandIcon({ mode: find("brand-icon-mode").value, value: find("brand-icon-mode").value === "emoji" ? find("brand-icon-emoji").value : imageData });
  function preview() {
    const mode = find("brand-icon-mode").value;
    find("brand-emoji-field").hidden = mode !== "emoji";
    find("brand-image-field").hidden = mode !== "image";
    let valid = false;
    try { applyBrandIcon(find("brand-icon-preview"), current()); valid = true; }
    catch { applyBrandIcon(find("brand-icon-preview"), { mode: "theme" }); }
    find("save-brand-icon").disabled = busy || !valid;
  }
  function lock(value) {
    busy = value;
    root.setAttribute("aria-busy", String(value));
    root.querySelectorAll("input, select, button").forEach((element) => element.disabled = value);
    preview();
  }
  find("brand-icon-mode").addEventListener("change", () => { preview(); status("Preview only. Save icon to apply it across your devices."); });
  find("brand-icon-emoji").addEventListener("input", () => {
    preview();
    try { current(); status("Preview only. Save icon to apply it."); }
    catch (err) { status(err.message); }
  });
  find("brand-icon-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    lock(true); status("Preparing a small, static icon…");
    try { imageData = await prepareBrandImage(file); status("Image ready. Save icon to apply it. It will fit inside the existing title badge."); }
    catch (err) { status(`${err.message} Your saved icon has not changed.`); }
    finally { event.target.value = ""; lock(false); }
  });
  find("save-brand-icon").addEventListener("click", async () => {
    if (busy) return;
    let icon;
    try { icon = current(); } catch (err) { return status(err.message); }
    lock(true);
    try { status(await save(icon) ? "Title icon saved across your devices." : "Could not save the icon. Your saved icon is unchanged."); }
    finally { lock(false); }
  });
  find("reset-brand-icon").addEventListener("click", async () => {
    if (busy) return;
    lock(true);
    try {
      if (await save({ mode: "theme" })) {
        find("brand-icon-mode").value = "theme";
        imageData = "";
        status("Original theme icon restored.");
      } else status("Could not reset the icon. Your saved icon is unchanged.");
    } finally { lock(false); }
  });
  preview();
}
