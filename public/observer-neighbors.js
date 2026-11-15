/* === CoreScope — observer-neighbors.js ===
 * #2270 / #2271: the latest /neighbors report of an observer, on the
 * observers list (cell) and the observer page (cards + table). Pure render
 * helpers, no fetching; window global so observers.js and observer-detail.js
 * share them and the XSS sink test can call them directly.
 *
 * Every string in a report is observer-published (MQTT) or mesh-published
 * (node names), so everything is escaped here. */
'use strict';

window.ObserverNeighbors = (function () {
  // i18n.js defines tr()/trn(); sandboxes that load this file alone get English.
  var tr = globalThis.tr || function (s, p) { return p ? s.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(p, k) ? String(p[k]) : m; }) : s; };
  var trn = globalThis.trn || function (n, one, other, p) { return tr(n === 1 ? one : other, Object.assign({ count: n }, p)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function ago(ms) {
    if (!isFinite(ms) || ms < 0) return '—';
    var s = Math.floor(ms / 1000);
    if (s < 60) return tr('{count}s ago', { count: s });
    var m = Math.floor(s / 60);
    if (m < 60) return tr('{count}m ago', { count: m });
    var h = Math.floor(m / 60);
    if (h < 48) return tr('{count}h ago', { count: h });
    return tr('{count}d ago', { count: Math.floor(h / 24) });
  }

  function since(iso, nowMs) {
    var t = Date.parse(iso);
    return isNaN(t) ? '—' : ago(nowMs - t);
  }

  // cell: "3h ago · 12" for the observers table, "—" when never reported.
  function cell(o, nowMs) {
    if (!o || !o.neighbors_report_at) return '<span class="text-muted" title="' + esc(tr('No /neighbors report received')) + '">—</span>';
    var n = Number(o.neighbors_count);
    var count = isFinite(n) ? n : 0;
    return '<span title="' + esc(trn(count, 'Latest /neighbors report {time}: {count} neighbor', 'Latest /neighbors report {time}: {count} neighbors', { time: o.neighbors_report_at })) + '">' + since(o.neighbors_report_at, nowMs || Date.now()) +
      ' · ' + count + '</span>';
  }

  function snr(v) {
    var n = Number(v);
    return v == null || !isFinite(n) ? '—' : n.toFixed(1) + ' dB';
  }

  function heard(secs) {
    var n = Number(secs);
    return secs == null || !isFinite(n) ? '—' : ago(n * 1000);
  }

  // detailHtml: the report as a table for the observer page, "" without one.
  function detailHtml(rep) {
    if (!rep || !Array.isArray(rep.neighbors)) return '';
    var cellStyle = 'padding:3px 8px';
    var rows = rep.neighbors.map(function (n) {
      var key = String(n.pubkey || '');
      var label = n.name ? esc(n.name) : '<span class="mono">' + esc(key.slice(0, 8)) + '…</span>';
      return '<tr>' +
        '<td style="' + cellStyle + '"><a href="#/nodes/' + encodeURIComponent(key) + '">' + label + '</a>' +
          (n.role ? ' <span class="text-muted">' + esc(tr(n.role)) + '</span>' : '') + '</td>' +
        '<td style="' + cellStyle + '">' + snr(n.snr) + '</td>' +
        '<td style="' + cellStyle + '">' + heard(n.heard_secs_ago) + '</td>' +
        '<td style="' + cellStyle + '">' + (n.status ? esc(n.status) : '—') + '</td>' +
        '<td style="' + cellStyle + '" class="mono">' + (n.scopes ? esc(n.scopes) : '—') + '</td>' +
        '</tr>';
    }).join('');
    var head = '<th style="' + cellStyle + ';text-align:left">';
    var meta = [];
    if (rep.reported_at) meta.push(esc(tr('reported {time}', { time: rep.reported_at })));
    if (rep.queried_neighbors != null) meta.push(esc(tr('{count} scope queries sent', { count: rep.queried_neighbors })));
    if (rep.self_scopes) meta.push(esc(tr('own scopes {scopes}', { scopes: rep.self_scopes })));
    if (rep.self_default_scope) meta.push(esc(tr('default scope {scope}', { scope: rep.self_default_scope })));
    var shown = rep.neighbors.length;
    var count = Number(rep.neighbor_count);
    var more = isFinite(count) && count > shown ? ' (' + tr('{shown} of {count} listed', { shown: shown, count: count }) + ')' : '';
    return '<div class="node-full-card" data-testid="observer-neighbors" style="margin-bottom:20px;padding:12px">' +
      '<h4 style="margin:0 0 6px">' + tr('Neighbors') + more + '</h4>' +
      (meta.length ? '<div class="text-muted" style="font-size:12px;margin-bottom:6px">' + meta.join(' · ') + '</div>' : '') +
      (shown ? '<table style="border-collapse:collapse;font-size:0.85em"><thead><tr>' +
        head + tr('Node') + '</th>' + head + 'SNR</th>' + head + tr('Heard') + '</th>' + head + tr('Scope query') + '</th>' + head + tr('Scopes') + '</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>'
        : '<div class="text-muted">' + tr('The latest report lists no neighbors.') + '</div>') +
      '</div>';
  }

  return { cell: cell, detailHtml: detailHtml, since: since };
})();
