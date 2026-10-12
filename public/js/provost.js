/**
 * HostelCare :: Chief Provost Directorate JavaScript
 */

let currentUser = null;
let complaints = [];
let categoryFilter = 'all';
let ledgerView = window.innerWidth <= 768 ? 'cards' : 'table';

const CATEGORIES = {
  Electrical: { icon: '⚡', class: 'cat-electrical', color: '#b45309' },
  Plumbing: { icon: '🚰', class: 'cat-plumbing', color: '#0369a1' },
  Carpentry: { icon: '🪚', class: 'cat-carpentry', color: '#854d0e' },
  Food: { icon: '🍲', class: 'cat-food', color: '#b91c1c' },
  Discipline: { icon: '⚖️', class: 'cat-discipline', color: '#6b21a8' }
};

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setupEventListeners();
  initSSE();
  setInterval(() => {
    fetchProvostStats();
    fetchComplaints();
  }, 20000);
});

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await res.json();
    currentUser = data.user;

    if (currentUser.role !== 'provost') {
      window.location.href = '/access-denied.html';
      return;
    }

    document.getElementById('provostName').textContent = currentUser.name;

    await fetchProvostStats();
    await fetchComplaints();
  } catch (err) {
    window.location.href = '/login.html';
  }
}

async function fetchProvostStats() {
  try {
    const res = await fetch('/api/stats/provost');
    if (!res.ok) return;
    const stats = await res.json();

    document.getElementById('provostTotal').textContent = stats.kpis.total;
    document.getElementById('provostPending').textContent = stats.kpis.pending;
    document.getElementById('provostInProgress').textContent = stats.kpis.inProgress;
    document.getElementById('provostResolved').textContent = stats.kpis.resolved;
    document.getElementById('provostBreached').textContent = stats.kpis.breached;
    document.getElementById('provostRate').textContent = `${stats.kpis.resolutionRate}%`;

    // Category Breakdown Bars
    const catContainer = document.getElementById('categoryBarsContainer');
    const total = stats.kpis.total || 1;
    catContainer.innerHTML = Object.entries(stats.categoryStats).map(([cat, count]) => {
      const percent = Math.round((count / total) * 100);
      const meta = CATEGORIES[cat] || { icon: '📋', color: '#3b82f6' };
      return `
        <div class="meter-item">
          <div class="meter-header">
            <span>${meta.icon} ${cat}</span>
            <span><strong>${count}</strong> tickets (${percent}%)</span>
          </div>
          <div class="meter-track">
            <div class="meter-fill" style="width: ${percent}%; background: ${meta.color};"></div>
          </div>
        </div>
      `;
    }).join('');

    // Activity Feed
    const feed = document.getElementById('provostActivityFeed');
    feed.innerHTML = stats.recentActivities.map(act => `
      <div class="feed-item">
        <div>
          <div class="feed-time">${formatTimeAgo(act.time)} &bull; #${act.ticketNumber} [${act.category}]</div>
          <div class="feed-text"><strong>${escapeHtml(act.actor)}:</strong> ${escapeHtml(act.action)}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error fetching Provost stats:', err);
  }
}

async function fetchComplaints() {
  try {
    const res = await fetch(`/api/complaints?category=${categoryFilter}`);
    complaints = await res.json();
    renderTable();
  } catch (err) {
    console.error('Error fetching complaints:', err);
  }
}

function setupEventListeners() {
  // Logout
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  // Category filter
  document.getElementById('provostCategoryFilter').addEventListener('change', (e) => {
    categoryFilter = e.target.value;
    fetchComplaints();
  });

  // Ledger View Toggle (Mobile Cards vs Table)
  const btnCards = document.getElementById('btnToggleCards');
  const btnTable = document.getElementById('btnToggleTable');
  if (btnCards && btnTable) {
    btnCards.addEventListener('click', () => {
      ledgerView = 'cards';
      updateLedgerView();
    });
    btnTable.addEventListener('click', () => {
      ledgerView = 'table';
      updateLedgerView();
    });
  }

  window.addEventListener('resize', () => {
    // Only auto-update if hint needs to show/hide
    const scrollHint = document.getElementById('tableScrollHint');
    if (scrollHint && ledgerView === 'table') {
      scrollHint.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    }
  });

  // Detail Modal Close
  document.getElementById('btnCloseDetailModal').addEventListener('click', () => {
    document.getElementById('ticketDetailModal').classList.remove('active');
  });
  document.getElementById('btnCloseDetailModalBtn').addEventListener('click', () => {
    document.getElementById('ticketDetailModal').classList.remove('active');
  });
}

function updateLedgerView() {
  const tableContainer = document.getElementById('provostTableContainer');
  const cardsContainer = document.getElementById('provostCardsContainer');
  const scrollHint = document.getElementById('tableScrollHint');
  const btnCards = document.getElementById('btnToggleCards');
  const btnTable = document.getElementById('btnToggleTable');

  if (ledgerView === 'cards') {
    if (cardsContainer) cardsContainer.style.display = 'grid';
    if (tableContainer) tableContainer.style.display = 'none';
    if (scrollHint) scrollHint.style.display = 'none';
    if (btnCards) btnCards.classList.add('active');
    if (btnTable) btnTable.classList.remove('active');
  } else {
    if (cardsContainer) cardsContainer.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
    if (scrollHint) scrollHint.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    if (btnCards) btnCards.classList.remove('active');
    if (btnTable) btnTable.classList.add('active');
  }
}

function initSSE() {
  const sse = new EventSource('/api/events');
  sse.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (['TICKET_CREATED', 'PROFESSIONAL_ASSIGNED', 'STATUS_UPDATED', 'SLA_BREACHED'].includes(data.type)) {
        fetchProvostStats();
        fetchComplaints();
      }
    } catch (err) {}
  };
}

function renderTable() {
  const tbody = document.getElementById('provostTableBody');
  const cardsContainer = document.getElementById('provostCardsContainer');

  if (complaints.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding: 2.5rem; color: var(--slate-500);">
          No complaints found in this category.
        </td>
      </tr>
    `;
    if (cardsContainer) {
      cardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--slate-500); background: #ffffff; border-radius: var(--radius-lg); border: 1px dashed var(--slate-300);">
          No complaints found in this category.
        </div>
      `;
    }
    updateLedgerView();
    return;
  }

  // 1. Render Table Rows (Desktop / Wide view)
  tbody.innerHTML = complaints.map(t => {
    const cat = CATEGORIES[t.category] || { icon: '📋', class: 'cat-electrical' };
    const sla = calculateSla(t);
    const isBreached = t.slaBreached && t.status !== 'Resolved';
    const rowClass = isBreached ? 'row-breached' : '';

    const profText = t.assignedProfessional
      ? `<strong style="color:var(--primary-800);">${escapeHtml(t.assignedProfessional.name)}</strong><br><span style="font-size:0.75rem; color:var(--slate-500);">${escapeHtml(t.assignedProfessional.phone)}</span>`
      : `<span style="color:var(--slate-400); font-style:italic;">None assigned</span>`;

    let statusClass = 'status-pending';
    if (t.status === 'Resolved') statusClass = 'status-resolved';
    else if (t.status === 'In Progress') statusClass = 'status-progress';
    if (isBreached) statusClass = 'status-breached';

    return `
      <tr class="${rowClass}">
        <td><strong>#${t.ticketNumber}</strong></td>
        <td><span class="badge-category ${cat.class}">${cat.icon} ${t.category}</span></td>
        <td>
          <div style="font-weight:600;">${escapeHtml(t.hostel)}</div>
          <div style="font-size:0.75rem; color:var(--slate-500);">Room: ${escapeHtml(t.room)}</div>
        </td>
        <td>
          <div style="font-weight:600;">${escapeHtml(t.studentName)}</div>
          <div style="font-size:0.75rem; color:var(--slate-500);">${escapeHtml(t.studentEmail)}</div>
        </td>
        <td>
          <div style="font-weight:600;">${escapeHtml(t.assignedSupervisorName)}</div>
          <div style="font-size:0.72rem; color:var(--slate-500);">${t.category} Supervisor</div>
        </td>
        <td>${profText}</td>
        <td>
          <div class="sla-badge-text ${sla.textClass}" style="font-size:0.78rem;">${sla.badgeText}</div>
          <div class="sla-bar" style="width: 100px; margin-top:3px;">
            <div class="sla-bar-fill ${sla.fillClass}" style="width: ${sla.progressPercent}%"></div>
          </div>
        </td>
        <td><span class="badge-status ${statusClass}">${t.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm btn-inspect" data-id="${t.id}">
            🔍 Inspect
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // 2. Render Mobile / Responsive Cards
  if (cardsContainer) {
    cardsContainer.innerHTML = complaints.map(t => {
      const cat = CATEGORIES[t.category] || { icon: '📋', class: 'cat-electrical' };
      const sla = calculateSla(t);
      const isBreached = t.slaBreached && t.status !== 'Resolved';
      const cardBreachedClass = isBreached ? 'card-breached' : '';

      const profText = t.assignedProfessional
        ? `<strong>${escapeHtml(t.assignedProfessional.name)}</strong> (${escapeHtml(t.assignedProfessional.phone)})`
        : `<span style="color:var(--slate-400); font-style:italic;">None assigned</span>`;

      let statusClass = 'status-pending';
      if (t.status === 'Resolved') statusClass = 'status-resolved';
      else if (t.status === 'In Progress') statusClass = 'status-progress';
      if (isBreached) statusClass = 'status-breached';

      return `
        <div class="provost-card ${cardBreachedClass}">
          <div class="provost-card-header">
            <div>
              <span style="font-weight:700; font-size:1.05rem; color:var(--primary-700);">#${t.ticketNumber}</span>
              <div style="font-weight:600; font-size:0.95rem; margin-top:3px; color:var(--slate-900);">${escapeHtml(t.title)}</div>
            </div>
            <span class="badge-category ${cat.class}">${cat.icon} ${t.category}</span>
          </div>

          <div class="provost-card-body">
            <div class="provost-card-row">
              <span>🏛️</span>
              <div><strong>${escapeHtml(t.hostel)}</strong> &bull; Room: <strong>${escapeHtml(t.room)}</strong></div>
            </div>
            <div class="provost-card-row">
              <span>🎓</span>
              <div>Student: <strong>${escapeHtml(t.studentName)}</strong> <span style="font-size:0.75rem; color:var(--slate-500);">(${escapeHtml(t.studentEmail)})</span></div>
            </div>
            <div class="provost-card-row">
              <span>👔</span>
              <div>Supervisor: <strong>${escapeHtml(t.assignedSupervisorName)}</strong> (${t.category})</div>
            </div>
            <div class="provost-card-row">
              <span>🛠️</span>
              <div>Technician: ${profText}</div>
            </div>

            <div class="provost-card-sla">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <span class="sla-badge-text ${sla.textClass}" style="font-size:0.8rem; font-weight:700;">${sla.badgeText}</span>
                <span class="badge-status ${statusClass}">${t.status}</span>
              </div>
              <div class="sla-bar" style="width: 100%;">
                <div class="sla-bar-fill ${sla.fillClass}" style="width: ${sla.progressPercent}%"></div>
              </div>
            </div>
          </div>

          <button class="btn btn-secondary btn-inspect" data-id="${t.id}" style="width:100%; justify-content:center; padding:0.65rem; font-weight:600;">
            🔍 Inspect Ticket & Audit
          </button>
        </div>
      `;
    }).join('');
  }

  // Bind inspect button click handlers for both views
  document.querySelectorAll('.btn-inspect').forEach(b => {
    b.addEventListener('click', () => openDetailModal(b.dataset.id));
  });

  updateLedgerView();
}

function calculateSla(t) {
  if (t.status === 'Resolved') {
    return { badgeText: '✓ Resolved Within SLA', textClass: 'ok', fillClass: 'fill-ok', progressPercent: 100 };
  }
  const now = Date.now();
  const created = new Date(t.createdAt).getTime();
  const deadline = new Date(t.deadline).getTime();
  const total = 24 * 3600 * 1000;
  const elapsed = now - created;
  const remaining = deadline - now;
  const percent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));

  if (remaining <= 0 || t.slaBreached) {
    const overdueMinutes = Math.abs(Math.round(remaining / (60 * 1000)));
    const h = Math.floor(overdueMinutes / 60);
    const m = overdueMinutes % 60;
    return { badgeText: `🚨 BREACHED (+${h}h ${m}m overdue)`, textClass: 'breached', fillClass: 'fill-breached', progressPercent: 100 };
  }

  const remH = Math.floor(remaining / (3600 * 1000));
  const remM = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
  return { badgeText: `⏱️ ${remH}h ${remM}m left`, textClass: remH < 4 ? 'warning' : 'ok', fillClass: remH < 4 ? 'fill-warning' : 'fill-ok', progressPercent: percent };
}

async function openDetailModal(ticketId) {
  try {
    const res = await fetch(`/api/complaints/${ticketId}`);
    if (!res.ok) throw new Error('Complaint not found.');
    const ticket = await res.json();

    const cat = CATEGORIES[ticket.category] || { icon: '📋', class: 'cat-electrical' };
    const sla = calculateSla(ticket);

    document.getElementById('modalCategoryBadge').className = `badge-category ${cat.class}`;
    document.getElementById('modalCategoryBadge').innerHTML = `${cat.icon} ${ticket.category}`;
    document.getElementById('modalTicketTitle').textContent = ticket.title;
    document.getElementById('modalTicketMeta').innerHTML = `
      <strong>#${ticket.ticketNumber}</strong> &bull; Student: <strong>${escapeHtml(ticket.studentName)}</strong> (${escapeHtml(ticket.hostel)} - Room ${escapeHtml(ticket.room)})
    `;

    document.getElementById('modalDescriptionBox').textContent = ticket.description;

    const profBox = document.getElementById('modalProfessionalBox');
    if (ticket.assignedProfessional) {
      profBox.innerHTML = `
        <div style="font-weight:700; color:var(--primary-800); font-size:1rem;">
          🛠️ ${escapeHtml(ticket.assignedProfessional.name)}
        </div>
        <div style="margin-top:0.35rem; font-size:0.88rem; color:var(--slate-700);">
          📞 Contact: <strong>${escapeHtml(ticket.assignedProfessional.phone)}</strong><br>
          🕒 Expected Visit: <strong>${escapeHtml(ticket.assignedProfessional.expectedVisitTime)}</strong><br>
          ${ticket.assignedProfessional.notes ? `📝 <em>Instructions: ${escapeHtml(ticket.assignedProfessional.notes)}</em>` : ''}
        </div>
      `;
    } else {
      profBox.innerHTML = `<div style="color:var(--slate-500); font-style:italic;">No field technician assigned yet.</div>`;
    }

    const resSec = document.getElementById('modalResolutionSection');
    const resBox = document.getElementById('modalResolutionBox');
    if (ticket.resolution) {
      resSec.style.display = 'block';
      resBox.innerHTML = `
        <div style="font-weight:700; color:var(--emerald-700);">✓ Work Verified by ${escapeHtml(ticket.resolution.resolvedBy)}</div>
        <div style="margin-top:0.25rem; font-size:0.85rem; color:var(--slate-700);">${escapeHtml(ticket.resolution.notes)}</div>
      `;
    } else {
      resSec.style.display = 'none';
    }

    document.getElementById('modalSlaStatusBadge').textContent = ticket.status;
    document.getElementById('modalSlaCountdownText').textContent = sla.badgeText;
    document.getElementById('modalSlaProgressBar').style.width = `${sla.progressPercent}%`;
    document.getElementById('modalSlaProgressBar').className = `sla-progress-fill ${sla.fillClass}`;
    document.getElementById('modalSlaDeadlineText').textContent = `24h Target: ${new Date(ticket.deadline).toLocaleString()}`;

    const timelineList = document.getElementById('modalTimelineList');
    timelineList.innerHTML = (ticket.timeline || []).map(tl => `
      <div class="timeline-item">
        <div class="timeline-time">${new Date(tl.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; ${new Date(tl.time).toLocaleDateString()}</div>
        <div class="timeline-actor">${escapeHtml(tl.actor)}</div>
        <div class="timeline-action">${escapeHtml(tl.action)}</div>
      </div>
    `).join('');

    document.getElementById('modalFooterActions').innerHTML = `
      <button type="button" class="btn btn-primary" onclick="alert('Priority executive notification dispatched to Supervisor ${ticket.assignedSupervisorName}!')">🔔 Ping Supervisor</button>
      <button type="button" class="btn btn-secondary" onclick="document.getElementById('ticketDetailModal').classList.remove('active')">Close</button>
    `;

    document.getElementById('ticketDetailModal').classList.add('active');
  } catch (err) {
    alert(err.message);
  }
}

function formatTimeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}
