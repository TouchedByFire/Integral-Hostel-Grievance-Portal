/**
 * HostelCare :: Student Grievance & Redressal Portal
 * Client Application Logic & Real-Time SSE Synchronization
 */

// Application Global State
const state = {
  users: [],
  currentUser: null,
  complaints: [],
  emails: [],
  activeStudentFilter: 'all',
  activeSupervisorFilter: 'all',
  provostCategoryFilter: 'all',
  sseSource: null
};

// Category Metadata
const CATEGORIES = {
  Electrical: { icon: '⚡', class: 'cat-electrical', color: '#b45309' },
  Plumbing: { icon: '🚰', class: 'cat-plumbing', color: '#0369a1' },
  Carpentry: { icon: '🪚', class: 'cat-carpentry', color: '#854d0e' },
  Food: { icon: '🍲', class: 'cat-food', color: '#b91c1c' },
  Discipline: { icon: '⚖️', class: 'cat-discipline', color: '#6b21a8' }
};

// DOM Initializer
document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  setupEventListeners();
  initRealTimeSync();
  startSlaTicker();
});

// Load Users, Complaints, and Emails
async function loadInitialData() {
  try {
    const [usersRes, emailsRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/emails')
    ]);

    state.users = await usersRes.json();
    state.emails = await emailsRes.json();
    updateEmailBadge();

    // Default to first student
    const defaultUser = state.users.find(u => u.id === 'usr_student_1') || state.users[0];
    switchUser(defaultUser.id);
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('Connection Error', 'Could not connect to backend server.', true);
  }
}

// Fetch complaints from server for current user role
async function fetchComplaints() {
  if (!state.currentUser) return;
  try {
    let url = '/api/complaints';
    if (state.currentUser.role === 'student') {
      url += `?role=student&userId=${state.currentUser.id}`;
    } else if (state.currentUser.role === 'supervisor') {
      url += `?role=supervisor&userId=${state.currentUser.id}`;
    }
    const res = await fetch(url);
    state.complaints = await res.json();
    renderActiveView();
  } catch (err) {
    console.error('Failed to fetch complaints:', err);
  }
}

// Set up DOM event listeners
function setupEventListeners() {
  // Role Selector Switcher
  const roleSelector = document.getElementById('roleSelector');
  roleSelector.addEventListener('change', (e) => {
    switchUser(e.target.value);
  });

  // Email Outbox Modal
  document.getElementById('btnEmailOutbox').addEventListener('click', openEmailOutbox);
  document.getElementById('btnCloseEmailOutbox').addEventListener('click', closeEmailOutbox);

  // Student Filter Tabs
  document.querySelectorAll('#studentView .filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('#studentView .filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeStudentFilter = e.target.dataset.filter;
      renderStudentView();
    });
  });

  // Student Search
  const searchInput = document.getElementById('studentSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderStudentView());
  }

  // Raise Complaint Modal Triggers
  document.getElementById('btnOpenNewComplaintModal').addEventListener('click', openNewComplaintModal);
  document.getElementById('btnCloseNewComplaintModal').addEventListener('click', closeNewComplaintModal);
  document.getElementById('btnCancelNewComplaint').addEventListener('click', closeNewComplaintModal);
  document.getElementById('newComplaintForm').addEventListener('submit', handleCreateComplaint);

  // Supervisor Filter Tabs
  document.querySelectorAll('#supervisorFilterTabs .filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('#supervisorFilterTabs .filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeSupervisorFilter = e.target.dataset.filter;
      renderSupervisorView();
    });
  });

  // Assign Professional Modal Triggers
  document.getElementById('btnCloseAssignModal').addEventListener('click', closeAssignModal);
  document.getElementById('btnCancelAssign').addEventListener('click', closeAssignModal);
  document.getElementById('assignProfessionalForm').addEventListener('submit', handleAssignProfessional);

  // Resolve Modal Triggers
  document.getElementById('btnCloseResolveModal').addEventListener('click', closeResolveModal);
  document.getElementById('btnCancelResolve').addEventListener('click', closeResolveModal);
  document.getElementById('resolveTicketForm').addEventListener('submit', handleResolveTicket);

  // Detail Modal Close
  document.getElementById('btnCloseDetailModal').addEventListener('click', closeDetailModal);

  // Provost Category Filter
  const provostCatFilter = document.getElementById('provostCategoryFilter');
  if (provostCatFilter) {
    provostCatFilter.addEventListener('change', (e) => {
      state.provostCategoryFilter = e.target.value;
      renderProvostView();
    });
  }

  // Fast Forward Demo Buttons
  const btnFastForward = document.getElementById('btnFastForwardDemo');
  if (btnFastForward) btnFastForward.addEventListener('click', handleFastForwardClick);

  const btnProvostFast = document.getElementById('btnProvostFastForward');
  if (btnProvostFast) btnProvostFast.addEventListener('click', handleFastForwardClick);
}

// Real-Time Server-Sent Events (SSE) stream
function initRealTimeSync() {
  if (state.sseSource) state.sseSource.close();

  state.sseSource = new EventSource('/api/events');

  state.sseSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleIncomingSSE(data);
    } catch (e) {
      console.error('SSE parse error:', e);
    }
  };

  state.sseSource.onerror = () => {
    console.warn('SSE stream reconnecting...');
  };
}

function handleIncomingSSE(data) {
  const { type, payload } = data;

  switch (type) {
    case 'TICKET_CREATED':
      showToast('New Complaint Logged', `Ticket #${payload.ticketNumber} registered in ${payload.category}.`);
      fetchComplaints();
      break;

    case 'PROFESSIONAL_ASSIGNED':
      showToast('Technician Dispatched', `Professional assigned to #${payload.ticketNumber}.`);
      fetchComplaints();
      break;

    case 'STATUS_UPDATED':
      showToast('Status Update', `Ticket #${payload.ticketNumber} is now ${payload.status}.`);
      fetchComplaints();
      break;

    case 'SLA_BREACHED':
      showToast('🚨 24h SLA Breached!', `Ticket #${payload.ticketNumber} overdue! Apology email sent to student.`, true);
      fetchComplaints();
      break;

    case 'EMAIL_DISPATCHED':
      state.emails.unshift(payload);
      updateEmailBadge();
      break;
  }
}

// User Switching Handler
function switchUser(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  state.currentUser = user;

  const selector = document.getElementById('roleSelector');
  if (selector && selector.value !== userId) {
    selector.value = userId;
  }

  renderRoleBanner();
  fetchComplaints();
}

// Render Top Banner according to active user
function renderRoleBanner() {
  const banner = document.getElementById('roleBanner');
  const user = state.currentUser;
  if (!banner || !user) return;

  let avatar = '🎓';
  let roleTitle = 'Hostel Student';
  let metaInfo = `${user.hostel} &bull; Room ${user.room} &bull; ID: ${user.studentId}`;
  let slaBadge = `
    <div class="banner-badge-sla">
      <div class="banner-sla-title">Guaranteed Resolution SLA</div>
      <div class="banner-sla-val">24 Hours Strict</div>
    </div>
  `;

  if (user.role === 'supervisor') {
    const cat = CATEGORIES[user.category] || { icon: '🛠️' };
    avatar = cat.icon;
    roleTitle = `${user.category} Maintenance Supervisor`;
    metaInfo = `${user.title} &bull; Mobile: ${user.phone}`;
    slaBadge = `
      <div class="banner-badge-sla">
        <div class="banner-sla-title">Department SLA Target</div>
        <div class="banner-sla-val">&lt; 24h Turnaround</div>
      </div>
    `;
  } else if (user.role === 'provost') {
    avatar = '🏛️';
    roleTitle = 'Chief Provost';
    metaInfo = `${user.title} &bull; Full Campus Jurisdiction &bull; Executive Real-Time Dashboard`;
    slaBadge = `
      <div class="banner-badge-sla">
        <div class="banner-sla-title">SLA Compliance Oversight</div>
        <div class="banner-sla-val">Active Real-Time</div>
      </div>
    `;
  }

  banner.innerHTML = `
    <div class="banner-left">
      <div class="banner-avatar">${avatar}</div>
      <div>
        <div class="banner-name">
          ${user.name}
          <span class="banner-role-tag">${roleTitle}</span>
        </div>
        <div class="banner-meta">${metaInfo}</div>
      </div>
    </div>
    ${slaBadge}
  `;
}

// Route between Student, Supervisor, and Provost Views
function renderActiveView() {
  const studentView = document.getElementById('studentView');
  const supervisorView = document.getElementById('supervisorView');
  const provostView = document.getElementById('provostView');

  studentView.style.display = 'none';
  supervisorView.style.display = 'none';
  provostView.style.display = 'none';

  if (state.currentUser.role === 'student') {
    studentView.style.display = 'block';
    renderStudentView();
  } else if (state.currentUser.role === 'supervisor') {
    supervisorView.style.display = 'block';
    renderSupervisorView();
  } else if (state.currentUser.role === 'provost') {
    provostView.style.display = 'block';
    renderProvostView();
  }
}

// ========================================================
// 1. STUDENT VIEW LOGIC
// ========================================================
function renderStudentView() {
  const grid = document.getElementById('studentComplaintsGrid');
  if (!grid) return;

  const searchVal = (document.getElementById('studentSearchInput')?.value || '').toLowerCase();

  let list = state.complaints.filter(c => {
    // Role filter
    if (state.activeStudentFilter === 'active') return c.status !== 'Resolved';
    if (state.activeStudentFilter === 'breached') return c.slaBreached && c.status !== 'Resolved';
    if (state.activeStudentFilter === 'resolved') return c.status === 'Resolved';
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
        <p style="font-size: 1.1rem; font-weight: 600; color: var(--slate-600);">No complaints found in this category.</p>
        <p style="font-size: 0.85rem; color: var(--slate-400); margin-top: 0.25rem;">You can raise a new complaint anytime using the "+ Raise New Complaint" button above.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(ticket => createStudentTicketCard(ticket)).join('');

  // Add click handlers on cards
  grid.querySelectorAll('.ticket-card').forEach(card => {
    card.addEventListener('click', () => {
      openDetailModal(card.dataset.id);
    });
  });
}

function createStudentTicketCard(t) {
  const cat = CATEGORIES[t.category] || { icon: '📋', class: 'cat-electrical' };
  const slaCalc = calculateSlaStatus(t);

  const isBreached = t.slaBreached && t.status !== 'Resolved';
  const cardBreachedClass = isBreached ? 'breached-card' : '';

  let profHtml = '';
  if (t.assignedProfessional) {
    profHtml = `
      <div class="card-prof-box">
        <div class="card-prof-title">🛠️ Assigned Field Professional:</div>
        <div class="card-prof-details">
          <strong>${t.assignedProfessional.name}</strong> &bull; Contact: <strong>${t.assignedProfessional.phone}</strong><br>
          <span style="font-size: 0.78rem; color: var(--slate-600);">Expected Visit: ${t.assignedProfessional.expectedVisitTime}</span>
        </div>
      </div>
    `;
  } else {
    profHtml = `
      <div class="card-prof-box" style="background: var(--slate-50); border-color: var(--slate-200);">
        <div class="card-prof-title" style="color: var(--slate-600);">⏳ In Review with Supervisor:</div>
        <div style="font-size: 0.78rem; color: var(--slate-500);">
          Supervisor <strong>${t.assignedSupervisorName}</strong> is reviewing and assigning a technician.
        </div>
      </div>
    `;
  }

  let statusBadgeClass = 'status-pending';
  if (t.status === 'Resolved') statusBadgeClass = 'status-resolved';
  else if (t.status === 'In Progress') statusBadgeClass = 'status-progress';
  if (isBreached) statusBadgeClass = 'status-breached';

  return `
    <div class="ticket-card ${cardBreachedClass}" data-id="${t.id}">
      <div>
        <div class="card-top">
          <span class="badge-category ${cat.class}">${cat.icon} ${t.category}</span>
          <span class="ticket-id">#${t.ticketNumber}</span>
        </div>
        <h3 class="card-title">${escapeHtml(t.title)}</h3>
        <p class="card-desc">${escapeHtml(t.description)}</p>
        ${profHtml}
      </div>

      <div class="card-sla-block">
        <div class="sla-header-flex">
          <span class="sla-badge-text ${slaCalc.textClass}">${slaCalc.badgeText}</span>
          <span class="badge-status ${statusBadgeClass}">${t.status}</span>
        </div>
        <div class="sla-bar">
          <div class="sla-bar-fill ${slaCalc.fillClass}" style="width: ${slaCalc.progressPercent}%"></div>
        </div>
      </div>
    </div>
  `;
}

// ========================================================
// 2. SUPERVISOR VIEW LOGIC
// ========================================================
function renderSupervisorView() {
  const user = state.currentUser;
  const tbody = document.getElementById('supervisorTableBody');
  const titleElem = document.getElementById('supervisorDepartmentTitle');

  if (titleElem) {
    titleElem.textContent = `${user.category} Complaints Queue (${user.name})`;
  }

  // Filter complaints for this supervisor category
  const categoryComplaints = state.complaints.filter(c => c.category === user.category);

  // Update Supervisor KPI Stats
  const total = categoryComplaints.length;
  const unassigned = categoryComplaints.filter(c => !c.assignedProfessional && c.status !== 'Resolved').length;
  const inProgress = categoryComplaints.filter(c => c.status === 'In Progress').length;
  const breached = categoryComplaints.filter(c => c.slaBreached && c.status !== 'Resolved').length;

  document.getElementById('supTotalCount').textContent = total;
  document.getElementById('supPendingCount').textContent = unassigned;
  document.getElementById('supInProgressCount').textContent = inProgress;
  document.getElementById('supBreachedCount').textContent = breached;

  // Filter tab logic
  let filtered = [...categoryComplaints];
  if (state.activeSupervisorFilter === 'unassigned') {
    filtered = filtered.filter(c => !c.assignedProfessional && c.status !== 'Resolved');
  } else if (state.activeSupervisorFilter === 'in_progress') {
    filtered = filtered.filter(c => c.status === 'In Progress');
  } else if (state.activeSupervisorFilter === 'breached') {
    filtered = filtered.filter(c => c.slaBreached && c.status !== 'Resolved');
  } else if (state.activeSupervisorFilter === 'resolved') {
    filtered = filtered.filter(c => c.status === 'Resolved');
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 2.5rem; color: var(--slate-500);">
          No complaints currently matching this filter for the ${user.category} domain.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const slaCalc = calculateSlaStatus(t);
    const isBreached = t.slaBreached && t.status !== 'Resolved';
    const rowBreachedClass = isBreached ? 'row-breached' : '';

    let profCol = '';
    if (t.assignedProfessional) {
      profCol = `
        <div style="font-weight:600; color: var(--primary-800);">${t.assignedProfessional.name}</div>
        <div style="font-size:0.75rem; color: var(--slate-500);">📞 ${t.assignedProfessional.phone}</div>
        <div style="font-size:0.75rem; color: var(--slate-600);">🕒 ${t.assignedProfessional.expectedVisitTime}</div>
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
          <button class="btn btn-primary btn-sm btn-action-assign" data-id="${t.id}" title="Assign or change offline technician">
            🛠️ Assign
          </button>
          <button class="btn btn-success btn-sm btn-action-resolve" data-id="${t.id}" title="Mark complaint resolved">
            ✓ Resolve
          </button>
          <button class="btn btn-secondary btn-sm btn-action-inspect" data-id="${t.id}" title="Inspect full audit trail">
            🔍 View
          </button>
        </div>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-secondary btn-sm btn-action-inspect" data-id="${t.id}">
          🔍 View Details
        </button>
      `;
    }

    return `
      <tr class="${rowBreachedClass}">
        <td><strong style="color:var(--primary-800);">#${t.ticketNumber}</strong></td>
        <td>
          <div style="font-weight:600;">${escapeHtml(t.studentName)}</div>
          <div style="font-size:0.75rem; color:var(--slate-500);">${escapeHtml(t.hostel)} - Room ${escapeHtml(t.room)}</div>
        </td>
        <td>
          <div style="font-weight:600; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(t.title)}
          </div>
          <div style="font-size:0.75rem; color:var(--slate-500); max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(t.description)}
          </div>
        </td>
        <td><span class="badge-status status-progress" style="font-size:0.72rem;">${t.priority}</span></td>
        <td>
          <div class="sla-badge-text ${slaCalc.textClass}" style="font-size:0.78rem;">${slaCalc.badgeText}</div>
          <div class="sla-bar" style="width: 120px; margin-top:4px;">
            <div class="sla-bar-fill ${slaCalc.fillClass}" style="width: ${slaCalc.progressPercent}%"></div>
          </div>
        </td>
        <td>${profCol}</td>
        <td><span class="badge-status ${statusBadgeClass}">${t.status}</span></td>
        <td>${actionButtons}</td>
      </tr>
    `;
  }).join('');

  // Attach Supervisor Action Button Listeners
  tbody.querySelectorAll('.btn-action-assign').forEach(btn => {
    btn.addEventListener('click', () => openAssignModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-action-resolve').forEach(btn => {
    btn.addEventListener('click', () => openResolveModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-action-inspect').forEach(btn => {
    btn.addEventListener('click', () => openDetailModal(btn.dataset.id));
  });
}

// ========================================================
// 3. PROVOST EXECUTIVE DASHBOARD LOGIC
// ========================================================
async function renderProvostView() {
  try {
    const res = await fetch('/api/stats/provost');
    const stats = await res.json();

    // Render KPI Metrics
    document.getElementById('provostTotal').textContent = stats.kpis.total;
    document.getElementById('provostPending').textContent = stats.kpis.pending;
    document.getElementById('provostInProgress').textContent = stats.kpis.inProgress;
    document.getElementById('provostResolved').textContent = stats.kpis.resolved;
    document.getElementById('provostBreached').textContent = stats.kpis.breached;
    document.getElementById('provostRate').textContent = `${stats.kpis.resolutionRate}%`;

    // Render Category Breakdown Bars
    const catContainer = document.getElementById('categoryBarsContainer');
    if (catContainer) {
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
    }

    // Render Live Activity Feed
    const feed = document.getElementById('provostActivityFeed');
    if (feed) {
      feed.innerHTML = stats.recentActivities.map(act => `
        <div class="feed-item">
          <div>
            <div class="feed-time">${formatTimeAgo(act.time)} &bull; #${act.ticketNumber} [${act.category}]</div>
            <div class="feed-text"><strong>${escapeHtml(act.actor)}:</strong> ${escapeHtml(act.action)}</div>
          </div>
        </div>
      `).join('');
    }

    // Render Master Grievance Table
    const tbody = document.getElementById('provostTableBody');
    if (tbody) {
      let list = [...state.complaints];
      if (state.provostCategoryFilter !== 'all') {
        list = list.filter(c => c.category === state.provostCategoryFilter);
      }

      tbody.innerHTML = list.map(t => {
        const cat = CATEGORIES[t.category] || { icon: '📋', class: 'cat-electrical' };
        const slaCalc = calculateSlaStatus(t);
        const isBreached = t.slaBreached && t.status !== 'Resolved';
        const rowClass = isBreached ? 'row-breached' : '';

        const profText = t.assignedProfessional
          ? `<strong style="color:var(--primary-800);">${t.assignedProfessional.name}</strong><br><span style="font-size:0.75rem; color:var(--slate-500);">${t.assignedProfessional.phone}</span>`
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
              <div class="sla-badge-text ${slaCalc.textClass}" style="font-size:0.78rem;">${slaCalc.badgeText}</div>
              <div class="sla-bar" style="width: 100px; margin-top:3px;">
                <div class="sla-bar-fill ${slaCalc.fillClass}" style="width: ${slaCalc.progressPercent}%"></div>
              </div>
            </td>
            <td><span class="badge-status ${statusClass}">${t.status}</span></td>
            <td>
              <button class="btn btn-secondary btn-sm btn-provost-inspect" data-id="${t.id}">
                🔍 Inspect
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-provost-inspect').forEach(btn => {
        btn.addEventListener('click', () => openDetailModal(btn.dataset.id));
      });
    }

  } catch (err) {
    console.error('Error rendering Provost view:', err);
  }
}

// ========================================================
// SLA STATUS & COUNTDOWN CALCULATOR
// ========================================================
function calculateSlaStatus(t) {
  if (t.status === 'Resolved') {
    return {
      badgeText: '✓ Resolved Within SLA',
      textClass: 'ok',
      fillClass: 'fill-ok',
      progressPercent: 100
    };
  }

  const now = Date.now();
  const created = new Date(t.createdAt).getTime();
  const deadline = new Date(t.deadline).getTime();
  const totalDuration = 24 * 60 * 60 * 1000; // 24 hours

  const elapsed = now - created;
  const remaining = deadline - now;

  const percent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

  if (remaining <= 0 || t.slaBreached) {
    const overdueMinutes = Math.abs(Math.round(remaining / (60 * 1000)));
    const overdueHours = Math.floor(overdueMinutes / 60);
    const mins = overdueMinutes % 60;
    return {
      badgeText: `🚨 BREACHED (+${overdueHours}h ${mins}m overdue)`,
      textClass: 'breached',
      fillClass: 'fill-breached',
      progressPercent: 100
    };
  }

  const remHours = Math.floor(remaining / (60 * 60 * 1000));
  const remMinutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  let textClass = 'ok';
  let fillClass = 'fill-ok';
  if (remHours < 4) {
    textClass = 'warning';
    fillClass = 'fill-warning';
  }

  return {
    badgeText: `⏱️ ${remHours}h ${remMinutes}m left`,
    textClass,
    fillClass,
    progressPercent: percent
  };
}

// Global Ticker that re-renders timers every 60 seconds
function startSlaTicker() {
  setInterval(() => {
    if (state.currentUser?.role === 'student') {
      renderStudentView();
    } else if (state.currentUser?.role === 'supervisor') {
      renderSupervisorView();
    }
  }, 30000);
}

// ========================================================
// MODAL ACTIONS & HANDLERS
// ========================================================

// 1. Raise Complaint
function openNewComplaintModal() {
  const user = state.currentUser;
  if (!user || user.role !== 'student') return;

  document.getElementById('studentHostelRoom').value = `${user.hostel} - Room ${user.room}`;
  document.getElementById('studentEmailInput').value = user.email;
  document.getElementById('complaintTitle').value = '';
  document.getElementById('complaintDescription').value = '';
  document.getElementById('complaintCategory').value = '';
  document.getElementById('complaintPriority').value = 'Normal';

  document.getElementById('newComplaintModal').classList.add('active');
}

function closeNewComplaintModal() {
  document.getElementById('newComplaintModal').classList.remove('active');
}

async function handleCreateComplaint(e) {
  e.preventDefault();
  const user = state.currentUser;

  const payload = {
    studentName: user.name,
    studentEmail: user.email,
    studentId: user.studentId,
    hostel: user.hostel,
    room: user.room,
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
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to submit complaint');
    }

    const newTicket = await res.json();
    closeNewComplaintModal();
    showToast('Complaint Registered!', `Ticket #${newTicket.ticketNumber} created. Confirmation email sent to ${user.email}.`);
    fetchComplaints();
  } catch (err) {
    alert(err.message);
  }
}

// 2. Assign Professional
function openAssignModal(ticketId) {
  const ticket = state.complaints.find(c => c.id === ticketId);
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

function closeAssignModal() {
  document.getElementById('assignProfessionalModal').classList.remove('active');
}

async function handleAssignProfessional(e) {
  e.preventDefault();
  const ticketId = document.getElementById('assignTicketId').value;
  const user = state.currentUser;

  const payload = {
    professionalName: document.getElementById('profName').value.trim(),
    professionalPhone: document.getElementById('profPhone').value.trim(),
    expectedVisitTime: document.getElementById('profVisitTime').value.trim(),
    notes: document.getElementById('profNotes').value.trim(),
    supervisorName: user.name
  };

  try {
    const res = await fetch(`/api/complaints/${ticketId}/assign-professional`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Failed to assign professional');

    closeAssignModal();
    showToast('Professional Assigned!', `Technician ${payload.professionalName} assigned to ticket.`);
    fetchComplaints();
  } catch (err) {
    alert(err.message);
  }
}

// 3. Resolve Ticket
function openResolveModal(ticketId) {
  const ticket = state.complaints.find(c => c.id === ticketId);
  if (!ticket) return;

  document.getElementById('resolveTicketId').value = ticket.id;
  document.getElementById('resolveTicketSummaryBanner').innerHTML = `
    <strong>#${ticket.ticketNumber} - ${escapeHtml(ticket.title)}</strong><br>
    <span style="color:var(--slate-500); font-size:0.8rem;">Student: ${escapeHtml(ticket.studentName)} &bull; ${escapeHtml(ticket.hostel)} - Room ${escapeHtml(ticket.room)}</span>
  `;
  document.getElementById('resolutionNotes').value = '';

  document.getElementById('resolveTicketModal').classList.add('active');
}

function closeResolveModal() {
  document.getElementById('resolveTicketModal').classList.remove('active');
}

async function handleResolveTicket(e) {
  e.preventDefault();
  const ticketId = document.getElementById('resolveTicketId').value;
  const user = state.currentUser;

  const payload = {
    status: 'Resolved',
    notes: document.getElementById('resolutionNotes').value.trim(),
    updatedBy: user.name
  };

  try {
    const res = await fetch(`/api/complaints/${ticketId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Failed to resolve ticket');

    closeResolveModal();
    showToast('Ticket Resolved ✓', `Ticket marked as Resolved and confirmation dispatched.`);
    fetchComplaints();
  } catch (err) {
    alert(err.message);
  }
}

// 4. Ticket Detail Drawer
function openDetailModal(ticketId) {
  const ticket = state.complaints.find(c => c.id === ticketId);
  if (!ticket) return;

  const cat = CATEGORIES[ticket.category] || { icon: '📋', class: 'cat-electrical' };
  const slaCalc = calculateSlaStatus(ticket);

  document.getElementById('modalCategoryBadge').className = `badge-category ${cat.class}`;
  document.getElementById('modalCategoryBadge').innerHTML = `${cat.icon} ${ticket.category}`;
  document.getElementById('modalTicketTitle').textContent = ticket.title;
  document.getElementById('modalTicketMeta').innerHTML = `
    <strong>#${ticket.ticketNumber}</strong> &bull; Student: <strong>${escapeHtml(ticket.studentName)}</strong> (${escapeHtml(ticket.hostel)} - Room ${escapeHtml(ticket.room)}) &bull; Priority: <strong>${ticket.priority}</strong>
  `;

  document.getElementById('modalDescriptionBox').textContent = ticket.description;

  // Assigned Professional Box
  const profBox = document.getElementById('modalProfessionalBox');
  if (ticket.assignedProfessional) {
    profBox.innerHTML = `
      <div style="font-weight:700; color:var(--primary-800); font-size:1rem;">
        🛠️ ${escapeHtml(ticket.assignedProfessional.name)}
      </div>
      <div style="margin-top:0.35rem; font-size:0.88rem; color:var(--slate-700);">
        📞 Phone: <strong>${escapeHtml(ticket.assignedProfessional.phone)}</strong><br>
        🕒 Expected Visit: <strong>${escapeHtml(ticket.assignedProfessional.expectedVisitTime)}</strong><br>
        ${ticket.assignedProfessional.notes ? `📝 <em>Instructions: ${escapeHtml(ticket.assignedProfessional.notes)}</em>` : ''}
      </div>
    `;
  } else {
    profBox.innerHTML = `
      <div style="color:var(--slate-500); font-style:italic;">
        No field technician has been assigned yet. Supervisor <strong>${ticket.assignedSupervisorName}</strong> is reviewing this request.
      </div>
    `;
  }

  // Resolution Section
  const resSection = document.getElementById('modalResolutionSection');
  const resBox = document.getElementById('modalResolutionBox');
  if (ticket.resolution) {
    resSection.style.display = 'block';
    resBox.innerHTML = `
      <div style="font-weight:700; color:var(--emerald-700);">✓ Work Completed by ${escapeHtml(ticket.resolution.resolvedBy)}</div>
      <div style="margin-top:0.25rem; font-size:0.85rem; color:var(--slate-700);">
        ${escapeHtml(ticket.resolution.notes)}<br>
        <span style="font-size:0.75rem; color:var(--slate-400);">Resolved on: ${new Date(ticket.resolution.resolvedAt).toLocaleString()}</span>
      </div>
    `;
  } else {
    resSection.style.display = 'none';
  }

  // SLA Card in Modal
  document.getElementById('modalSlaStatusBadge').textContent = ticket.status;
  document.getElementById('modalSlaStatusBadge').className = `badge-status ${ticket.slaBreached ? 'status-breached' : 'status-progress'}`;
  document.getElementById('modalSlaCountdownText').textContent = slaCalc.badgeText;
  document.getElementById('modalSlaCountdownText').className = `sla-countdown-val ${slaCalc.textClass}`;
  document.getElementById('modalSlaProgressBar').className = `sla-progress-fill ${slaCalc.fillClass}`;
  document.getElementById('modalSlaProgressBar').style.width = `${slaCalc.progressPercent}%`;
  document.getElementById('modalSlaDeadlineText').textContent = `24h Target Deadline: ${new Date(ticket.deadline).toLocaleString()}`;

  // Timeline
  const timelineList = document.getElementById('modalTimelineList');
  timelineList.innerHTML = ticket.timeline.map(item => `
    <div class="timeline-item">
      <div class="timeline-time">${new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; ${new Date(item.time).toLocaleDateString()}</div>
      <div class="timeline-actor">${escapeHtml(item.actor)}</div>
      <div class="timeline-action">${escapeHtml(item.action)}</div>
    </div>
  `).join('');

  // Role Action Buttons at Bottom of Modal
  const actionsFooter = document.getElementById('modalDetailActions');
  let footerButtons = `<button type="button" class="btn btn-secondary" onclick="closeDetailModal()">Close</button>`;

  if (state.currentUser.role === 'supervisor' && ticket.status !== 'Resolved') {
    footerButtons += `
      <button type="button" class="btn btn-primary" onclick="closeDetailModal(); openAssignModal('${ticket.id}');">🛠️ Assign Professional</button>
      <button type="button" class="btn btn-success" onclick="closeDetailModal(); openResolveModal('${ticket.id}');">✓ Resolve Ticket</button>
    `;
  } else if (state.currentUser.role === 'provost') {
    footerButtons += `
      <button type="button" class="btn btn-secondary" onclick="simulatePingSupervisor('${ticket.assignedSupervisorName}')">🔔 Ping Supervisor</button>
    `;
  }

  actionsFooter.innerHTML = footerButtons;

  document.getElementById('ticketDetailModal').classList.add('active');
}

function closeDetailModal() {
  document.getElementById('ticketDetailModal').classList.remove('active');
}

// 5. Email Outbox Viewer
async function openEmailOutbox() {
  try {
    const res = await fetch('/api/emails');
    state.emails = await res.json();
    updateEmailBadge();

    const listContainer = document.getElementById('emailOutboxList');
    if (!listContainer) return;

    if (state.emails.length === 0) {
      listContainer.innerHTML = `<div style="padding:1.5rem; color:var(--slate-400); text-align:center;">No emails dispatched yet.</div>`;
    } else {
      listContainer.innerHTML = state.emails.map((em, idx) => {
        let typeBadge = 'color:#2563eb;';
        if (em.type === 'SLA_BREACH_APOLOGY') typeBadge = 'color:#dc2626;';
        else if (em.type === 'RESOLVED') typeBadge = 'color:#16a34a;';

        return `
          <div class="outbox-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
            <span class="outbox-item-type" style="${typeBadge}">${em.type.replace(/_/g, ' ')}</span>
            <div class="outbox-item-subject">${escapeHtml(em.subject)}</div>
            <div class="outbox-item-to">To: ${escapeHtml(em.to)} &bull; ${formatTimeAgo(em.sentAt)}</div>
          </div>
        `;
      }).join('');

      // Preview first email
      renderEmailPreview(0);

      // Attach click handlers
      listContainer.querySelectorAll('.outbox-item').forEach(item => {
        item.addEventListener('click', (e) => {
          listContainer.querySelectorAll('.outbox-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          renderEmailPreview(parseInt(item.dataset.idx, 10));
        });
      });
    }

    document.getElementById('emailOutboxModal').classList.add('active');
  } catch (err) {
    console.error('Failed to load email outbox:', err);
  }
}

function renderEmailPreview(idx) {
  const preview = document.getElementById('emailOutboxPreview');
  const em = state.emails[idx];
  if (!preview || !em) return;

  preview.innerHTML = `
    <div style="border-bottom: 1px solid var(--slate-200); padding-bottom: 0.85rem; margin-bottom: 1rem;">
      <h4 style="font-size:1.1rem; color:var(--slate-900);">${escapeHtml(em.subject)}</h4>
      <div style="font-size:0.8rem; color:var(--slate-500); margin-top:0.25rem;">
        <strong>To:</strong> ${escapeHtml(em.to)} &bull; 
        <strong>Sent:</strong> ${new Date(em.sentAt).toLocaleString()} &bull; 
        <strong>Ticket:</strong> #${em.ticketNumber}
      </div>
    </div>
    <div style="background:#ffffff; border-radius:8px;">
      ${em.bodyHtml}
    </div>
  `;
}

function closeEmailOutbox() {
  document.getElementById('emailOutboxModal').classList.remove('active');
}

function updateEmailBadge() {
  const badge = document.getElementById('emailCountBadge');
  if (badge) badge.textContent = state.emails.length;
}

// Fast Forward SLA Demo Trigger
async function handleFastForwardClick() {
  const activeTicket = state.complaints.find(c => c.status !== 'Resolved' && !c.slaBreached);
  if (!activeTicket) {
    alert('All tickets are either resolved or already SLA breached! Create a new complaint first to test.');
    return;
  }

  if (!confirm(`Trigger fast-forward on Ticket #${activeTicket.ticketNumber} (${activeTicket.category}) to simulate exceeding 24 hours?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/complaints/${activeTicket.id}/fast-forward-sla`, {
      method: 'POST'
    });
    const result = await res.json();
    showToast('🚨 24h SLA Breached!', result.message, true);
    fetchComplaints();
  } catch (err) {
    alert(err.message);
  }
}

function simulatePingSupervisor(supervisorName) {
  showToast('Supervisor Alerted', `Urgent high-priority reminder sent from Chief Provost to ${supervisorName}.`);
}

// Utilities
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
  return str.replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

function showToast(title, message, isAlert = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${isAlert ? 'toast-alert' : ''}`;
  toast.innerHTML = `
    <div style="font-size:1.35rem;">${isAlert ? '🚨' : '📬'}</div>
    <div>
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}
