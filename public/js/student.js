/**
 * IntegraCare :: Integral University Student Portal JavaScript
 */

let currentUser = null;
let complaints = [];
let emails = [];
let activeFilter = 'all';

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
  setInterval(renderComplaints, 30000);
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

    if (currentUser.role !== 'student') {
      window.location.href = '/access-denied.html';
      return;
    }

    document.getElementById('studentDisplayName').textContent = currentUser.name;
    document.getElementById('studentDisplayMeta').innerHTML = `
      <strong>${escapeHtml(currentUser.campus || 'Phase I')}</strong> &bull; ${escapeHtml(currentUser.hostel)} &bull; Room <strong>${escapeHtml(currentUser.room)}</strong> &bull; Enrollment: <strong>${escapeHtml(currentUser.enrollment_no || currentUser.student_id)}</strong>
    `;

    await fetchComplaints();
    await fetchEmails();
  } catch (err) {
    window.location.href = '/login.html';
  }
}

async function fetchComplaints() {
  try {
    const res = await fetch('/api/complaints');
    complaints = await res.json();
    renderComplaints();
  } catch (err) {
    console.error('Failed to load complaints:', err);
  }
}

async function fetchEmails() {
  try {
    const res = await fetch('/api/emails');
    emails = await res.json();
    document.getElementById('emailCountBadge').textContent = emails.length;
  } catch (err) {
    console.error('Failed to load emails:', err);
  }
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
      renderComplaints();
    });
  });

  // Search input
  document.getElementById('searchInput').addEventListener('input', renderComplaints);

  // Modals
  document.getElementById('btnOpenNewComplaintModal').addEventListener('click', () => {
    document.getElementById('newComplaintModal').classList.add('active');
  });
  document.getElementById('btnCloseNewComplaintModal').addEventListener('click', () => {
    document.getElementById('newComplaintModal').classList.remove('active');
  });
  document.getElementById('btnCancelNewComplaint').addEventListener('click', () => {
    document.getElementById('newComplaintModal').classList.remove('active');
  });

  document.getElementById('newComplaintForm').addEventListener('submit', handleCreateComplaint);

  // Detail Modal Close
  document.getElementById('btnCloseDetailModal').addEventListener('click', () => {
    document.getElementById('ticketDetailModal').classList.remove('active');
  });
  document.getElementById('btnCloseDetailModalBtn').addEventListener('click', () => {
    document.getElementById('ticketDetailModal').classList.remove('active');
  });

  // Outbox
  document.getElementById('btnEmailOutbox').addEventListener('click', openEmailOutbox);
  document.getElementById('btnCloseEmailOutbox').addEventListener('click', () => {
    document.getElementById('emailOutboxModal').classList.remove('active');
  });
}

function initSSE() {
  const sse = new EventSource('/api/events');
  sse.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (['TICKET_CREATED', 'PROFESSIONAL_ASSIGNED', 'STATUS_UPDATED', 'SLA_BREACHED'].includes(data.type)) {
        fetchComplaints();
        fetchEmails();
      }
    } catch (err) {}
  };
}

function renderComplaints() {
  const grid = document.getElementById('studentComplaintsGrid');
  const searchVal = (document.getElementById('searchInput').value || '').toLowerCase();

  let list = complaints.filter(c => {
    if (activeFilter === 'active') return c.status !== 'Resolved';
    if (activeFilter === 'breached') return c.slaBreached && c.status !== 'Resolved';
    if (activeFilter === 'resolved') return c.status === 'Resolved';
    return true;
  });

  if (searchVal) {
    list = list.filter(c =>
      c.title.toLowerCase().includes(searchVal) ||
      c.ticketNumber.toLowerCase().includes(searchVal) ||
      c.category.toLowerCase().includes(searchVal) ||
      c.description.toLowerCase().includes(searchVal)
    );
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #ffffff; border-radius: 12px; border: 1px dashed var(--slate-300);">
        <p style="font-size: 1.1rem; font-weight: 600; color: var(--slate-600);">No grievances found in this view.</p>
        <p style="font-size: 0.85rem; color: var(--slate-400); margin-top: 0.25rem;">Click "+ Register New Grievance" above to submit a complaint.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(t => {
    const cat = CATEGORIES[t.category] || { icon: '📋', class: 'cat-electrical' };
    const sla = calculateSla(t);
    const isBreached = t.slaBreached && t.status !== 'Resolved';
    const cardBreachedClass = isBreached ? 'breached-card' : '';

    let profRoleTitle = '🛠️ Assigned Professional:';
    let inReviewMsg = `Supervisor <strong>${escapeHtml(t.assignedSupervisorName)}</strong> is reviewing and assigning a professional.`;
    if (t.category === 'Food') {
      profRoleTitle = '🍽️ Assigned Catering Staff / Food Inspector:';
      inReviewMsg = `Supervisor <strong>${escapeHtml(t.assignedSupervisorName)}</strong> is reviewing and assigning mess inspection staff.`;
    } else if (t.category === 'Discipline') {
      profRoleTitle = '🛡️ Assigned Warden / Floor Proctor:';
      inReviewMsg = `Supervisor <strong>${escapeHtml(t.assignedSupervisorName)}</strong> is reviewing and assigning a floor proctor / warden.`;
    } else if (t.category === 'Plumbing') {
      profRoleTitle = '🔧 Assigned Plumber:';
      inReviewMsg = `Supervisor <strong>${escapeHtml(t.assignedSupervisorName)}</strong> is reviewing and assigning a plumber.`;
    } else if (t.category === 'Carpentry') {
      profRoleTitle = '🪚 Assigned Carpenter:';
      inReviewMsg = `Supervisor <strong>${escapeHtml(t.assignedSupervisorName)}</strong> is reviewing and assigning a carpenter.`;
    } else if (t.category === 'Electrical') {
      profRoleTitle = '⚡ Assigned Electrical Technician:';
      inReviewMsg = `Supervisor <strong>${escapeHtml(t.assignedSupervisorName)}</strong> is reviewing and assigning an electrician.`;
    }

    let profHtml = '';
    if (t.assignedProfessional) {
      profHtml = `
        <div class="card-prof-box">
          <div class="card-prof-title">${profRoleTitle}</div>
          <div class="card-prof-details">
            <strong>${escapeHtml(t.assignedProfessional.name)}</strong> &bull; Contact: <strong>${escapeHtml(t.assignedProfessional.phone)}</strong><br>
            <span style="font-size: 0.78rem; color: var(--slate-600);">Expected Visit: ${escapeHtml(t.assignedProfessional.expectedVisitTime)}</span>
          </div>
        </div>
      `;
    } else {
      profHtml = `
        <div class="card-prof-box" style="background: var(--slate-50); border-color: var(--slate-200);">
          <div class="card-prof-title" style="color: var(--slate-600);">⏳ In Review with Supervisor:</div>
          <div style="font-size: 0.78rem; color: var(--slate-500);">
            ${inReviewMsg}
          </div>
        </div>
      `;
    }

    let statusBadgeClass = 'status-pending';
    if (t.status === 'Resolved') statusBadgeClass = 'status-resolved';
    else if (t.status === 'In Progress') statusBadgeClass = 'status-progress';
    if (isBreached) statusBadgeClass = 'status-breached';

    return `
      <div class="ticket-card ${cardBreachedClass}" onclick="openDetailModal('${t.id}')">
        <div>
          <div class="card-top">
            <span class="badge-category ${cat.class}">${cat.icon} ${t.category}</span>
            <span class="ticket-id">#${t.ticketNumber}</span>
          </div>
          <h3 class="card-title">${escapeHtml(t.title)}</h3>
          <div style="font-size:0.75rem; color:var(--primary-700); font-weight:600; margin: 4px 0 8px 0;">
            📍 ${escapeHtml(t.campus || 'Phase I')} &bull; ${escapeHtml(t.hostel)} &bull; Room ${escapeHtml(t.room)}
          </div>
          <p class="card-desc">${escapeHtml(t.description)}</p>
          ${profHtml}
        </div>

        <div class="card-sla-block">
          <div class="sla-header-flex">
            <span class="sla-badge-text ${sla.textClass}">${sla.badgeText}</span>
            <span class="badge-status ${statusBadgeClass}">${t.status}</span>
          </div>
          <div class="sla-bar">
            <div class="sla-bar-fill ${sla.fillClass}" style="width: ${sla.progressPercent}%"></div>
          </div>
        </div>

        <div class="card-footer-action">
          <span>🔍 Tap to view complete timeline & updates</span>
          <span>&rarr;</span>
        </div>
      </div>
    `;
  }).join('');
}

function calculateSla(t) {
  if (t.status === 'Resolved') {
    return { badgeText: '✓ Resolved', textClass: 'ok', fillClass: 'fill-ok', progressPercent: 100 };
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
    return { badgeText: `🚨 Overdue (+${h}h ${m}m)`, textClass: 'breached', fillClass: 'fill-breached', progressPercent: 100 };
  }

  const remH = Math.floor(remaining / (3600 * 1000));
  const remM = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
  return { badgeText: `⏱️ ${remH}h ${remM}m left`, textClass: remH < 4 ? 'warning' : 'ok', fillClass: remH < 4 ? 'fill-warning' : 'fill-ok', progressPercent: percent };
}

async function handleCreateComplaint(e) {
  e.preventDefault();
  const payload = {
    category: document.getElementById('complaintCategory').value,
    priority: document.getElementById('complaintPriority').value,
    title: document.getElementById('complaintTitle').value.trim(),
    description: document.getElementById('complaintDescription').value.trim()
  };

  try {
    const res = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit grievance');
    }
    document.getElementById('newComplaintModal').classList.remove('active');
    document.getElementById('complaintTitle').value = '';
    document.getElementById('complaintDescription').value = '';
    await fetchComplaints();
    await fetchEmails();
    alert('Grievance successfully registered! Assigned supervisor has been notified.');
  } catch (err) {
    alert(err.message);
  }
}

async function openDetailModal(id) {
  try {
    const res = await fetch(`/api/complaints/${id}`);
    if (!res.ok) throw new Error('Complaint not found.');
    const ticket = await res.json();

    const cat = CATEGORIES[ticket.category] || { icon: '📋', class: 'cat-electrical' };
    const sla = calculateSla(ticket);

    document.getElementById('modalCategoryBadge').className = `badge-category ${cat.class}`;
    document.getElementById('modalCategoryBadge').innerHTML = `${cat.icon} ${ticket.category}`;
    document.getElementById('modalTicketTitle').textContent = ticket.title;
    document.getElementById('modalTicketMeta').innerHTML = `
      <strong>#${ticket.ticketNumber}</strong> &bull; Location: <strong>${escapeHtml(ticket.campus || 'Phase I')} &bull; ${escapeHtml(ticket.hostel)} - Room ${escapeHtml(ticket.room)}</strong> &bull; Priority: <strong>${escapeHtml(ticket.priority)}</strong>
    `;

    document.getElementById('modalDescriptionBox').textContent = ticket.description;

    const profBox = document.getElementById('modalProfessionalBox');
    const profTitleEl = document.getElementById('lblDetailAssignedProf');
    if (profTitleEl) {
      if (ticket.category === 'Food') profTitleEl.textContent = 'Assigned Catering Staff / Food Inspector';
      else if (ticket.category === 'Discipline') profTitleEl.textContent = 'Assigned Hostel Warden / Floor Proctor';
      else if (ticket.category === 'Plumbing') profTitleEl.textContent = 'Assigned Plumber';
      else if (ticket.category === 'Carpentry') profTitleEl.textContent = 'Assigned Carpenter';
      else profTitleEl.textContent = 'Assigned Electrical Technician';
    }

    let roleLabel = 'Field Professional';
    if (ticket.category === 'Food') roleLabel = 'Catering Staff / Food Inspector';
    else if (ticket.category === 'Discipline') roleLabel = 'Hostel Warden / Floor Proctor';
    else if (ticket.category === 'Plumbing') roleLabel = 'Plumber';
    else if (ticket.category === 'Carpentry') roleLabel = 'Carpenter';
    else if (ticket.category === 'Electrical') roleLabel = 'Electrical Technician';

    if (ticket.assignedProfessional) {
      profBox.innerHTML = `
        <div style="font-weight:700; color:var(--primary-800); font-size:1rem;">
          ${cat.icon} ${escapeHtml(ticket.assignedProfessional.name)} <span style="font-size:0.8rem; font-weight:600; color:var(--slate-500);">(${roleLabel})</span>
        </div>
        <div style="margin-top:0.35rem; font-size:0.88rem; color:var(--slate-700);">
          📞 Contact Mobile: <strong>${escapeHtml(ticket.assignedProfessional.phone)}</strong><br>
          🕒 Expected Arrival: <strong>${escapeHtml(ticket.assignedProfessional.expectedVisitTime)}</strong><br>
          ${ticket.assignedProfessional.notes ? `📝 <em>Instructions: ${escapeHtml(ticket.assignedProfessional.notes)}</em>` : ''}
        </div>
      `;
    } else {
      let notAssignedMsg = `Supervisor ${escapeHtml(ticket.assignedSupervisorName)} is reviewing and assigning a field professional.`;
      if (ticket.category === 'Food') notAssignedMsg = `Supervisor ${escapeHtml(ticket.assignedSupervisorName)} is reviewing and assigning catering staff / food inspector.`;
      else if (ticket.category === 'Discipline') notAssignedMsg = `Supervisor ${escapeHtml(ticket.assignedSupervisorName)} is reviewing and assigning a floor proctor / warden.`;
      else if (ticket.category === 'Plumbing') notAssignedMsg = `Supervisor ${escapeHtml(ticket.assignedSupervisorName)} is reviewing and assigning a plumber.`;
      else if (ticket.category === 'Carpentry') notAssignedMsg = `Supervisor ${escapeHtml(ticket.assignedSupervisorName)} is reviewing and assigning a carpenter.`;
      else if (ticket.category === 'Electrical') notAssignedMsg = `Supervisor ${escapeHtml(ticket.assignedSupervisorName)} is reviewing and assigning an electrical technician.`;
      profBox.innerHTML = `<div style="color:var(--slate-500); font-style:italic;">${notAssignedMsg}</div>`;
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
    document.getElementById('modalSlaDeadlineText').textContent = `Target SLA: ${new Date(ticket.deadline).toLocaleString()}`;

    const timelineList = document.getElementById('modalTimelineList');
    timelineList.innerHTML = (ticket.timeline || []).map(tl => {
      const actionText = formatTimelineActionForUI(tl.action, ticket.category);
      return `
        <div class="timeline-item">
          <div class="timeline-time">${new Date(tl.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; ${new Date(tl.time).toLocaleDateString()}</div>
          <div class="timeline-actor">${escapeHtml(tl.actor)}</div>
          <div class="timeline-action">${escapeHtml(actionText)}</div>
        </div>
      `;
    }).join('');

    document.getElementById('ticketDetailModal').classList.add('active');
  } catch (err) {
    alert(err.message);
  }
}

async function openEmailOutbox() {
  await fetchEmails();
  const listContainer = document.getElementById('emailOutboxList');
  if (emails.length === 0) {
    listContainer.innerHTML = `<div style="padding:1.5rem; color:var(--slate-400); text-align:center;">No official notifications sent yet.</div>`;
  } else {
    listContainer.innerHTML = emails.map((em, idx) => `
      <div class="outbox-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
        <span class="outbox-item-type" style="${em.type === 'SLA_BREACH_APOLOGY' ? 'color:#dc2626;' : 'color:#2563eb;'}">${em.type.replace(/_/g, ' ')}</span>
        <div class="outbox-item-subject">${escapeHtml(em.subject)}</div>
        <div class="outbox-item-to" style="font-size:0.75rem; color:var(--slate-500); margin-top:3px;">
          <span>From: <strong style="color:var(--primary-700);">${escapeHtml(em.from || 'hostel@iul.ac.in')}</strong></span><br>
          <span>To: ${escapeHtml(em.to)}</span>
        </div>
      </div>
    `).join('');

    renderEmailPreview(0);

    listContainer.querySelectorAll('.outbox-item').forEach(item => {
      item.addEventListener('click', () => {
        listContainer.querySelectorAll('.outbox-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        renderEmailPreview(parseInt(item.dataset.idx, 10));
      });
    });
  }
  document.getElementById('emailOutboxModal').classList.add('active');
}

function renderEmailPreview(idx) {
  const preview = document.getElementById('emailOutboxPreview');
  const em = emails[idx];
  if (!preview || !em) return;
  const fromAddr = em.from || 'hostel@iul.ac.in';
  preview.innerHTML = `
    <div style="border-bottom: 1px solid var(--slate-200); padding-bottom: 0.85rem; margin-bottom: 1rem;">
      <h4 style="font-size:1.1rem; color:var(--slate-900);">${escapeHtml(em.subject)}</h4>
      <div style="font-size:0.8rem; color:var(--slate-600); margin-top:0.35rem; display:flex; flex-wrap:wrap; gap:0.6rem; align-items:center;">
        <span><strong>From:</strong> <span style="color:var(--primary-700); font-weight:700;">${escapeHtml(fromAddr)}</span></span>
        <span>&bull;</span>
        <span><strong>To:</strong> ${escapeHtml(em.to)}</span>
        <span>&bull;</span>
        <span><strong>Sent:</strong> ${new Date(em.sentAt).toLocaleString()}</span>
      </div>
    </div>
    <div>${em.bodyHtml}</div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}

function formatTimelineActionForUI(actionText, category) {
  if (!actionText) return '';
  let text = actionText;
  const cat = (category || '').toLowerCase();

  if (cat.includes('food')) {
    text = text.replace(/Assigned\s+(?:field\s+)?technician:?/gi, 'Assigned catering staff / food inspector:');
    text = text.replace(/technician\s+assigned:?/gi, 'Catering staff / food inspector assigned:');
    text = text.replace(/\bfield\s+technician\b/gi, 'catering staff member');
    text = text.replace(/\btechnicians?\b/gi, 'catering staff');
  } else if (cat.includes('discipline')) {
    text = text.replace(/Assigned\s+(?:field\s+)?technician:?/gi, 'Assigned hostel warden / proctor:');
    text = text.replace(/technician\s+assigned:?/gi, 'Hostel warden / proctor assigned:');
    text = text.replace(/\bfield\s+technician\b/gi, 'hostel warden / proctor');
    text = text.replace(/\btechnicians?\b/gi, 'warden/proctor');
  } else if (cat.includes('plumb')) {
    text = text.replace(/Assigned\s+(?:field\s+)?technician:?/gi, 'Assigned plumber:');
    text = text.replace(/technician\s+assigned:?/gi, 'Plumber assigned:');
    text = text.replace(/\bfield\s+technician\b/gi, 'plumber');
    text = text.replace(/\btechnicians?\b/gi, 'plumber');
  } else if (cat.includes('carpent')) {
    text = text.replace(/Assigned\s+(?:field\s+)?technician:?/gi, 'Assigned carpenter:');
    text = text.replace(/technician\s+assigned:?/gi, 'Carpenter assigned:');
    text = text.replace(/\bfield\s+technician\b/gi, 'carpenter');
    text = text.replace(/\btechnicians?\b/gi, 'carpenter');
  } else if (cat.includes('elect')) {
    text = text.replace(/Assigned\s+technician:?/gi, 'Assigned electrical technician:');
  } else {
    text = text.replace(/Assigned\s+(?:field\s+)?technician:?/gi, 'Assigned field professional:');
  }
  return text;
}
