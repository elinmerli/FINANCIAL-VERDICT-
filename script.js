
(() => {
  "use strict";

  const ArchiveUI = {
    currency: "USD",

    setCurrency(code) {
      this.currency = code;
    },

    money(value, currency = this.currency) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "Unavailable";
      }

      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          maximumFractionDigits: 2
        }).format(Number(value));
      } catch {
        return `${Number(value).toFixed(2)} ${currency}`;
      }
    },

    number(value, digits = 2) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "Unavailable";
      }

      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: digits
      }).format(Number(value));
    },

    date(value) {
      if (!value) return "Date unavailable";

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return String(value);

      return parsed.toLocaleString();
    },

    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    },

    metric(label, value, note = "") {
      return `
        <article class="metric">
          <div class="metric-label">${this.escape(label)}</div>
          <div class="metric-value">${this.escape(value)}</div>
          <div class="metric-meta">${this.escape(note)}</div>
        </article>`;
    },

    panel(title, content) {
      return `
        <section class="panel">
          <h2>${this.escape(title)}</h2>
          ${content}
        </section>`;
    },

    table(headers, rows) {
      const head = headers.map(item =>
        `<th>${this.escape(item)}</th>`
      ).join("");

      const body = rows.map(row =>
        `<tr>${row.map(cell =>
          `<td>${this.escape(cell ?? "Unavailable")}</td>`
        ).join("")}</tr>`
      ).join("");

      return `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>`;
    },

    status(message, error = false) {
      return `<div class="status${error ? " error" : ""}">${this.escape(message)}</div>`;
    },

    convert(value, from, to) {
      return window.ArchiveData.convert(value, from, to);
    }
  };

  window.ArchiveUI = ArchiveUI;
})();
