
(() => {
  "use strict";

  const UI = {
    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    },

    money(value, currency = "USD") {
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
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
    },

    metric(label, value, note = "") {
      return `<article class="metric">
        <div class="metric-label">${this.escape(label)}</div>
        <div class="metric-value">${this.escape(value)}</div>
        <div class="metric-note">${this.escape(note)}</div>
      </article>`;
    },

    panel(title, content) {
      return `<section class="panel"><h2>${this.escape(title)}</h2>${content}</section>`;
    },

    status(message, error = false) {
      return `<div class="status${error ? " error" : ""}">${this.escape(message)}</div>`;
    },

    table(headers, rows) {
      const head = headers.map(value => `<th>${this.escape(value)}</th>`).join("");
      const body = rows.map(row =>
        `<tr>${row.map(value => `<td>${this.escape(value ?? "Unavailable")}</td>`).join("")}</tr>`
      ).join("");

      return `<div class="table-wrap">
        <table class="data-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
    },

    drawChart(canvasId, labels, values, label) {
      const canvas = document.getElementById(canvasId);
      if (!canvas || !Array.isArray(values) || !values.length) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(300, canvas.clientWidth);
      const height = Math.max(200, canvas.clientHeight || 270);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const valid = values.map(Number).filter(Number.isFinite);
      if (!valid.length) {
        context.fillStyle = "#9c9789";
        context.font = "12px sans-serif";
        context.fillText("No historical observations available", 15, 30);
        return;
      }

      const min = Math.min(...valid);
      const max = Math.max(...valid);
      const spread = max - min || Math.abs(max) * 0.05 || 1;
      const low = min - spread * 0.12;
      const high = max + spread * 0.12;

      const left = 58;
      const right = width - 18;
      const top = 25;
      const bottom = height - 35;
      const plotWidth = right - left;
      const plotHeight = bottom - top;

      context.font = "10px sans-serif";
      context.fillStyle = "#9c9789";
      context.strokeStyle = "#39382f";
      context.lineWidth = 1;

      for (let i = 0; i <= 4; i++) {
        const y = top + plotHeight * i / 4;
        const value = high - (high - low) * i / 4;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(right, y);
        context.stroke();
        context.fillText(value.toLocaleString(undefined, {
          maximumFractionDigits: 2
        }), 5, y + 3);
      }

      const points = values.map((value, index) => {
        const x = left + (values.length === 1 ? 0 : plotWidth * index / (values.length - 1));
        const y = bottom - ((Number(value) - low) / (high - low)) * plotHeight;
        return { x, y, value: Number(value) };
      }).filter(point => Number.isFinite(point.value));

      if (!points.length) return;

      context.beginPath();
      points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.strokeStyle = "#a38b60";
      context.lineWidth = 2;
      context.stroke();

      const last = points[points.length - 1];
      context.fillStyle = "#c5ad7c";
      context.beginPath();
      context.arc(last.x, last.y, 3, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "#c9c1b2";
      context.font = "11px sans-serif";
      context.fillText(label, left, 14);

      const firstLabel = labels[0] ?? "";
      const lastLabel = labels[labels.length - 1] ?? "";
      context.fillStyle = "#9c9789";
      context.font = "9px sans-serif";
      context.fillText(String(firstLabel), left, height - 9);
      context.textAlign = "right";
      context.fillText(String(lastLabel), right, height - 9);
      context.textAlign = "left";
    }
  };

  window.ArchiveUI = UI;
})();
