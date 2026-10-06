(function (root) {
  "use strict";
  const pending = new Map(), decorated = new WeakSet();
  const keyFor = (node) => `${node.tagName}:${node.id || [node.className, JSON.stringify(node.dataset)].join(":")}`;
  function message(text, tone) {
    let box = document.getElementById("workspace-action-result");
    if (!box) {
      box = document.createElement("div"); box.id = "workspace-action-result";
      document.body.appendChild(box);
    }
    box.className = `work-result work-${tone}`;
    box.setAttribute("role", tone === "error" ? "alert" : "status");
    box.replaceChildren();
    const content = document.createElement("span"); content.textContent = text; box.appendChild(content);
    const dismiss = document.createElement("button"); dismiss.type = "button"; dismiss.className = "ghost-button small-button";
    dismiss.textContent = "Dismiss"; dismiss.onclick = () => box.remove(); box.appendChild(dismiss);
    // Error details stay visible until explicitly dismissed or superseded by a successful action.
    if (tone !== "error") setTimeout(() => { if (box.contains(content)) box.remove(); }, 12000);
  }
  function enhance() {
    document.querySelectorAll("table").forEach((table) => {
      if (table.closest(".games-standings") || table.querySelector("thead tr:nth-child(2)")) return;
      const headers = [...table.querySelectorAll("thead tr:first-child th")].map((cell) => cell.textContent.trim());
      table.classList.add("work-responsive-table");
      table.querySelectorAll("tbody tr").forEach((row) => {
        [...row.children].forEach((cell, i) => { if (cell.colSpan === 1) cell.dataset.label = headers[i] || "Selection"; });
      });
    });
    document.querySelectorAll("button, form, select").forEach((node) => {
      const prop = node.tagName === "FORM" ? "onsubmit" : node.tagName === "SELECT" ? "onchange" : "onclick";
      const handler = node[prop];
      if (!handler || handler.constructor.name !== "AsyncFunction" || decorated.has(node)) return;
      const key = keyFor(node);
      const control = node.tagName === "FORM" ? node.querySelector('[type="submit"]') : node;
      if (pending.has(key) && control) { control.disabled = true; control.setAttribute("aria-busy", "true"); }
      decorated.add(node);
      node[prop] = async function (event) {
        if (pending.has(key)) { event.preventDefault(); return; }
        pending.set(key, true);
        const disabled = control?.disabled;
        const spinner = document.createElement("span"); spinner.className = "work-spinner"; spinner.setAttribute("aria-hidden", "true");
        if (control) { control.disabled = true; control.setAttribute("aria-busy", "true"); if (control.tagName !== "SELECT") control.prepend(spinner); }
        try { return await handler.call(this, event); }
        catch (error) { message(error.message || "The action failed. Please try again.", "error"); }
        finally {
          pending.delete(key); spinner.remove();
          if (control) { control.disabled = disabled; control.removeAttribute("aria-busy"); }
          // A render can replace the original control while its request is pending.
          if (node.id) {
            const replacement = document.getElementById(node.id);
            const next = replacement?.tagName === "FORM" ? replacement.querySelector('[type="submit"]') : replacement;
            if (next && next !== control) { next.disabled = disabled; next.removeAttribute("aria-busy"); }
          }
        }
      };
    });
  }
  root.addEventListener("emperors:write-result", (event) => {
    const detail = event.detail || {};
    if (!detail.result?.error) return;
    const successes = Array.isArray(detail.result.data) ? detail.result.data.length : 0;
    const failed = detail.result.partialFailures?.length;
    message(`${failed ? `${successes} saved, ${failed} failed. ` : "Database update failed. "}${detail.result.error.message}`, "error");
  });
  root.ClubHubModules = root.ClubHubModules || {}; root.ClubHubModules.workspaceUi = { enhance, message };
})(window);
