/**
 * HostelCare :: Supervisor Maintenance Workspace JavaScript
 */

let currentUser = null;
let complaints = [];
let activeFilter = 'all';
let ledgerView = window.innerWidth <= 768 ? 'cards' : 'table';

const CATEGORIES = {
  Electrical: { icon: '⚡', class: 'cat-electrical' },
  Plumbing: { icon: '🚰', class: 'cat-plumbing' },
  Carpentry: { icon: '🪚', class: 'cat-carpentry' },
  Food: { icon: '🍲', class: 'cat-food' },
  Discipline: { icon: '⚖️', class: 'cat-discipline' }
};

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setupEventListeners();
  initSSE();
  setInterval(renderTable, 30000);
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

    if (currentUser.role !== 'supervisor') {
      window.location.href = '/access-denied.html';
      return;
    }

    const cat = CATEGORIES[currentUser.category] || { icon: '🛠️' };
    document.getElementById('supBrandIcon').textContent = cat.icon;
    document.getElementById('supNavSub').textContent = `${currentUser.category} Maintenance Directorate`;
    document.getElementById('supAvatar').textContent = cat.icon;
    document.getElementById('supDisplayName').textContent = currentUser.name;
    document.getElementById('supDisplayMeta').textContent = `${currentUser.title} • Contact: ${currentUser.phone}`;
    document.getElementById('supQueueTitle').textContent = `${currentUser.category} Complaints Queue`;

    await fetchComplaints();
  } catch (err) {
    window.location.href = '/login.html';
  }
}

async function fetchComplaints() {
  try {
    const res = await fetch('/api/complaints');
    complaints = await res.json();
    updateKPIs();
    renderTable();
  } catch (err) {
    console.error('Failed to load supervisor complaints:', err);
  }
}

function updateKPIs() {
  const total = complaints.length;
  const unassigned = complaints.filter(c => !c.assignedProfessional && c.status !== 'Resolved').length;
  const inProgress = complaints.filter(c => c.status === 'In Progress').length;
  const breached = complaints.filter(c => c.slaBreached && c.status !== 'Resolved').length;

  document.getElementById('kpiTotal').textContent = total;
  document.getElementById('kpiUnassigned').textContent = unassigned;
  document.getElementById('kpiInProgress').textContent = inProgress;
  document.getElementById('kpiBreached').textContent = breached;
}

function setupEventListeners() {
  // Logout
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      activeFilter = e.target.dataset.filter;
      renderTable();
    });
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
    const scrollHint = document.getElementById('tableScrollHint');
    if (scrollHint && ledgerView === 'table') {
      scrollHint.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    }
  });

  // Assign Modal
  document.getElementById('btnCloseAssignModal').addEventListener('click', () => {
    document.getElementById('assignProfessionalModal').classList.remove('active');
  });
  document.getElementById('btnCancelAssign').addEventListener('click', () => {
    document.getElementById('assignProfessionalModal').classList.remove('active');
  });
  document.getElementById('assignProfessionalForm').addEventListener('submit', handleAssignProfessional);

  // Resolve Modal
  document.getElementById('btnCloseResolveModal').addEventListener('click', () => {
    document.getElementById('resolveTicketModal').classList.remove('active');
  });
  document.getElementById('btnCancelResolve').addEventListener('click', () => {
    document.getElementById('resolveTicketModal').classList.remove('active');
  });
  document.getElementById('resolveTicketForm').addEventListener('submit', handleResolveTicket);

  // Detail Modal Close
  document.getElementById('btnCloseDetailModal').addEventListener('click', () => {
    document.getElementById('ticketDetailModal').classList.remove('active');
  });
  document.getElementById('btnCloseDetailModalBtn').addEventListener('click', () => {
    document.getElementById('ticketDetailModal').classList.remove('active');
  });
}

function updateLedgerView() {
  const tableContainer = document.getElementById('supervisorTableContainer');
  const cardsContainer = document.getElementById('supervisorCardsContainer');
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
        fetchComplaints();
      }
    } catch (err) {}
  };
}

function renderTable() {
  const tbody = document.getElementById('supervisorTableBody');
  const cardsContainer = document.getElementById('supervisorCardsContainer');

  let list = complaints.filter(c => {
    if (activeFilter === 'unassigned') return !c.assignedProfessional && c.status !== 'Resolved';
    if (activeFilter === 'in_progress') return c.status === 'In Progress';
    if (activeFilter === 'breached') return c.slaBreached && c.status !== 'Resolved';
    if (activeFilter === 'resolved') return c.status === 'Resolved';
    return true;
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 2.5rem; color: var(--slate-500);">
          No complaints matching this filter in your domain.
        </td>
      </tr>
    `;
    if (cardsContainer) {
      cardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--slate-500); background: #ffffff; border-radius: var(--radius-lg); border: 1px dashed var(--slate-300);">
          No complaints matching this filter in your domain.
        </div>
      `;
    }
    updateLedgerView();
    return;
  }

  // 1. Render Table Rows (Desktop / Wide screen)
  tbody.innerHTML = list.map(t => {
    const sla = calculateSla(t);
    const isBreached = t.slaBreached && t.status !== 'Resolved';
    const rowClass = isBreached ? 'row-breached' : '';

    let profCol = '';
    if (t.assignedProfessional) {
      profCol = `
        <div style="font-weight:600; color: var(--primary-800);">${escapeHtml(t.assignedProfessional.name)}</div>
        <div style="font-size:0.75rem; color: var(--slate-500);">📞 ${escapeHtml(t.assignedProfessional.phone)}</div>
        <div style="font-size:0.75rem; color: var(--slate-600);">🕒 ${escapeHtml(t.assignedProfessional.expectedVisitTime)}</div>
      `;
    } else {
      profCol = `<span style="color:var(--amber-600); font-weight:600; font-size:0.8rem;">⚠️ Needs Professional</span>`;
    }

    let statusBadgeClass = 'status-pending';
    if (t.status === 'Resolved') statusBadgeClass = 'status-resolved';
    else if (t.status === 'In Progress') statusBadgeClass = 'status-progress';
    if (isBreached) statusBadgeClass = 'status-breached';

    let actionButtons = '';
    if (t.status !== 'Resolved') {
      actionButtons = `
        <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm btn-assign" data-id="${t.id}" title="Assign field professional">🛠️ Assign</button>
          <button class="btn btn-success btn-sm btn-resolve" data-id="${t.id}" title="Mark resolved">✓ Resolve</button>
          <button class="btn btn-secondary btn-sm btn-view" data-id="${t.id}">🔍 View</button>
        </div>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-secondary btn-sm btn-view" data-id="${t.id}">🔍 Details</button>
      `;
    }

    return `
      <tr class="${rowClass}">
        <td><strong style="color:var(--primary-800);">#${t.ticketNumber}</strong></td>
        <td>
          <div style="font-weight:600;">${escapeHtml(t.studentName)}</div>
          <div style="font-size:0.75rem; color:var(--slate-500);">${escapeHtml(t.hostel)} - Room ${escapeHtml(t.room)}</div>
        </td>
        <td>
          <div style="font-weight:600; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.title)}</div>
          <div style="font-size:0.75rem; color:var(--slate-500); max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.description)}</div>
        </td>
        <td><span class="badge-status status-progress" style="font-size:0.72rem;">${t.priority}</span></td>
        <td>
          <div class="sla-badge-text ${sla.textClass}" style="font-size:0.78rem;">${sla.badgeText}</div>
          <div class="sla-bar" style="width: 120px; margin-top:4px;">
            <div class="sla-bar-fill ${sla.fillClass}" style="width: ${sla.progressPercent}%"></div>
          </div>
        </td>
        <td>${profCol}</td>
        <td><span class="badge-status ${statusBadgeClass}">${t.status}</span></td>
        <td>${actionButtons}</td>
      </tr>
    `;
  }).join('');

  // 2. Render Mobile Action Cards
  if (cardsContainer) {
    cardsContainer.innerHTML = list.map(t => {
      const sla = calculateSla(t);
      const isBreached = t.slaBreached && t.status !== 'Resolved';
      const cardBreachedClass = isBreached ? 'card-breached' : '';

      let profText = '';
      if (t.assignedProfessional) {
        profText = `<strong>${escapeHtml(t.assignedProfessional.name)}</strong> (${escapeHtml(t.assignedProfessional.phone)}) &bull; Arrival: ${escapeHtml(t.assignedProfessional.expectedVisitTime)}`;
      } else {
        profText = `<span style="color:var(--amber-600); font-weight:700;">⚠️ Needs Professional Assigned</span>`;
      }

      let statusBadgeClass = 'status-pending';
      if (t.status === 'Resolved') statusBadgeClass = 'status-resolved';
      else if (t.status === 'In Progress') statusBadgeClass = 'status-progress';
      if (isBreached) statusBadgeClass = 'status-breached';

      let cardActions = '';
      if (t.status !== 'Resolved') {
        cardActions = `
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-top:0.75rem;">
            <button class="btn btn-primary btn-assign" data-id="${t.id}" style="padding:0.65rem 0.5rem; font-size:0.82rem; justify-content:center;">🛠️ Assign Professional</button>
            <button class="btn btn-success btn-resolve" data-id="${t.id}" style="padding:0.65rem 0.5rem; font-size:0.82rem; justify-content:center;">✓ Mark Resolved</button>
          </div>
          <button class="btn btn-secondary btn-view" data-id="${t.id}" style="width:100%; margin-top:0.45rem; padding:0.55rem; justify-content:center; font-size:0.82rem;">🔍 View Timeline & Audit</button>
        `;
      } else {
        cardActions = `
          <button class="btn btn-secondary btn-view" data-id="${t.id}" style="width:100%; margin-top:0.5rem; padding:0.6rem; justify-content:center;">🔍 Details & Resolution Report</button>
        `;
      }

      return `
        <div class="provost-card ${cardBreachedClass}">
          <div class="provost-card-header">
            <div>
              <span style="font-weight:700; font-size:1.05rem; color:var(--primary-700);">#${t.ticketNumber}</span>
              <div style="font-weight:600; font-size:0.95rem; margin-top:3px; color:var(--slate-900);">${escapeHtml(t.title)}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px;">
              <span class="badge-status ${statusBadgeClass}">${t.status}</span>
              <span style="font-size:0.72rem; color:var(--slate-500); font-weight:600;">Priority: ${t.priority}</span>
            </div>
          </div>

          <div class="provost-card-body">
            <p style="font-size:0.82rem; color:var(--slate-600); margin:0; line-height:1.4;">${escapeHtml(t.description)}</p>

            <div class="provost-card-row">
              <span>🏛️</span>
              <div><strong>${escapeHtml(t.hostel)}</strong> &bull; Room: <strong>${escapeHtml(t.room)}</strong></div>
            </div>
            <div class="provost-card-row">
              <span>🎓</span>
              <div>Student: <strong>${escapeHtml(t.studentName)}</strong></div>
            </div>
            <div class="provost-card-row">
              <span>🛠️</span>
              <div>Technician: ${profText}</div>
            </div>

            <div class="provost-card-sla">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <span class="sla-badge-text ${sla.textClass}" style="font-size:0.8rem; font-weight:700;">${sla.badgeText}</span>
              </div>
              <div class="sla-bar" style="width: 100%;">
                <div class="sla-bar-fill ${sla.fillClass}" style="width: ${sla.progressPercent}%"></div>
              </div>
            </div>
          </div>

          ${cardActions}
        </div>
      `;
    }).join('');
  }

  // Bind click handlers for both views
  document.querySelectorAll('.btn-assign').forEach(b => b.addEventListener('click', () => openAssignModal(b.dataset.id)));
  document.querySelectorAll('.btn-resolve').forEach(b => b.addEventListener('click', () => openResolveModal(b.dataset.id)));
  document.querySelectorAll('.btn-view').forEach(b => b.addEventListener('click', () => openDetailModal(b.dataset.id)));

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

function openAssignModal(ticketId) {
  const ticket = complaints.find(c => c.id === ticketId);
  if (!ticket) return;

  document.getElementById('assignTicketId').value = ticket.id;
  document.getElementById('assignModalSubtitle').textContent = `Designate technician for Ticket #${ticket.ticketNumber} [${ticket.category}]`;
  document.getElementById('assignTicketSummaryBanner').innerHTML = `
    <strong>${escapeHtml(ticket.title)}</strong><br>
    <span style="color:var(--slate-500); font-size:0.8rem;">Student: ${escapeHtml(ticket.studentName)} (${escapeHtml(ticket.hostel)} - Room ${escapeHtml(ticket.room)})</span>
  `;

  document.getElementById('profName').value = ticket.assignedProfessional?.name || '';
  document.getElementById('profPhone').value = ticket.assignedProfessional?.phone || '';
  document.getElementById('profVisitTime').value = ticket.assignedProfessional?.expectedVisitTime || 'Today at 3:00 PM';
  document.getElementById('profNotes').value = ticket.assignedProfessional?.notes || '';

  document.getElementById('assignProfessionalModal').classList.add('active');
}

async function handleAssignProfessional(e) {
  e.preventDefault();
  const ticketId = document.getElementById('assignTicketId').value;
  const payload = {
    professionalName: document.getElementById('profName').value.trim(),
    professionalPhone: document.getElementById('profPhone').value.trim(),
    expectedVisitTime: document.getElementById('profVisitTime').value.trim(),
    notes: document.getElementById('profNotes').value.trim()
  };

  try {
    const res = await fetch(`/api/complaints/${ticketId}/assign-professional`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to assign professional');
    document.getElementById('assignProfessionalModal').classList.remove('active');
    await fetchComplaints();
    alert(`Technician ${payload.professionalName} dispatched successfully! Status updated in MySQL.`);
  } catch (err) {
    alert(err.message);
  }
}

function openResolveModal(ticketId) {
  const ticket = complaints.find(c => c.id === ticketId);
  if (!ticket) return;

  document.getElementById('resolveTicketId').value = ticket.id;
  document.getElementById('resolveTicketSummaryBanner').innerHTML = `
    <strong>#${ticket.ticketNumber} - ${escapeHtml(ticket.title)}</strong><br>
    <span style="color:var(--slate-500); font-size:0.8rem;">Student: ${escapeHtml(ticket.studentName)} &bull; ${escapeHtml(ticket.hostel)} - Room ${escapeHtml(ticket.room)}</span>
  `;
  document.getElementById('resolutionNotes').value = '';

  document.getElementById('resolveTicketModal').classList.add('active');
}

async function handleResolveTicket(e) {
  e.preventDefault();
  const ticketId = document.getElementById('resolveTicketId').value;
  const payload = {
    status: 'Resolved',
    notes: document.getElementById('resolutionNotes').value.trim()
  };

  try {
    const res = await fetch(`/api/complaints/${ticketId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to resolve ticket');
    document.getElementById('resolveTicketModal').classList.remove('active');
    await fetchComplaints();
    alert('Ticket resolved successfully in MySQL! Resolution confirmation sent to student.');
  } catch (err) {
    alert(err.message);
  }
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

    document.getElementById('ticketDetailModal').classList.add('active');
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}
