/**
 * HostelCare :: Supervisor Maintenance Workspace JavaScript
 */

let currentUser = null;
let complaints = [];
let technicians = [];
let activeFilter = 'all';
let techActiveFilter = 'all';
let currentWorkspaceTab = 'complaints';
let ledgerView = window.innerWidth <= 768 ? 'cards' : 'table';

const CATEGORIES = {
  Electrical: { icon: '⚡', class: 'cat-electrical' },
  Plumbing: { icon: '🚰', class: 'cat-plumbing' },
  Carpentry: { icon: '🪚', class: 'cat-carpentry' },
  Food: { icon: '🍲', class: 'cat-food' },
  Discipline: { icon: '⚖️', class: 'cat-discipline' }
};

const DOMAIN_DIRECTORY_CONFIG = {
  Electrical: {
    department: 'Department of Electrical & Power Maintenance',
    tabLabel: '👷 Technicians Directory',
    tabIcon: '⚡',
    viewTitle: 'Electrical Technicians Directory',
    viewSubtitle: 'Maintain dedicated electrical personnel, live availability status, and 1-click dispatch across all university halls.',
    btnAddLabel: '➕ Add New Technician',
    selectLabel: '⚡ Select from Available Technicians',
    choosePlaceholder: '-- Choose Available Technician --',
    customOption: '+ Enter Custom / Other Technician',
    modalAddTitle: 'Add New Technician',
    modalEditTitle: 'Edit Technician Details',
    modalSub: 'Maintain technician details for instant ticket dispatch across all halls.',
    lblFormName: 'Technician Full Name',
    lblProfName: 'Technician Full Name',
    tableProfColHeader: 'Assigned Technician',
    entityName: 'Technician',
    entityPlural: 'Technicians',
    badgeUnit: 'Available',
    assignModalTitle: 'Assign Electrical Technician',
    assignModalSub: 'Designate an electrical maintenance technician to service this grievance.',
    saveCheckboxLabel: 'Save to technician directory for future 1-click dispatch',
    deleteModalTitle: 'Remove Technician',
    deleteModalMsg: 'This technician will no longer appear in your quick dispatch list.',
    resolutionActions: [
      { text: '✓ Defective tube light / LED bulb replaced and verified operational', val: 'Defective tube light / LED bulb replaced and verified operational.' },
      { text: '✓ Ceiling fan regulator / capacitor replaced; rotation & speed tested', val: 'Ceiling fan regulator / capacitor replaced; rotation and speed control verified normal.' },
      { text: '✓ Switchboard, power socket or MCB breaker repaired & load-tested', val: 'Switchboard, power socket or MCB breaker repaired / replaced and load-tested.' },
      { text: '✓ Geyser element / thermostat repaired; water heating verified', val: 'Geyser heating element / thermostat inspected, repaired, and water heating verified.' },
      { text: '✓ Short-circuit / loose wiring rectified and insulated safely', val: 'Power line short-circuit / loose wiring rectified and insulated safely.' },
      { text: '✓ Room air cooler / exhaust fan motor serviced and tested normal', val: 'Room air cooler / exhaust fan motor serviced and tested normal.' },
      { text: '✓ Main power line / phase supply restored and stabilized', val: 'Main power line / phase supply restored and stabilized.' },
      { text: '✓ Inspected on-site with student; electrical equipment verified normal', val: 'No defect found. Inspected on-site with student and confirmed normal and safe.' }
    ]
  },
  Plumbing: {
    department: 'Department of Plumbing & Water Sanitation',
    tabLabel: '🔧 Technicians Directory',
    tabIcon: '🚰',
    viewTitle: 'Plumbing & Sanitation Technicians Directory',
    viewSubtitle: 'Maintain dedicated plumbing and sanitation staff, live availability status, and rapid dispatch across all hostels.',
    btnAddLabel: '➕ Add New Technician',
    selectLabel: '⚡ Select from Available Plumbers',
    choosePlaceholder: '-- Choose Available Plumber --',
    customOption: '+ Enter Custom / Other Plumber',
    modalAddTitle: 'Add New Technician',
    modalEditTitle: 'Edit Technician Details',
    modalSub: 'Maintain technician details for instant ticket dispatch across all halls.',
    lblFormName: 'Technician Full Name',
    lblProfName: 'Technician Full Name',
    tableProfColHeader: 'Assigned Plumber / Tech',
    entityName: 'Technician',
    entityPlural: 'Technicians',
    badgeUnit: 'Available',
    assignModalTitle: 'Assign Plumbing Technician',
    assignModalSub: 'Designate an offline plumbing technician to service this grievance.',
    saveCheckboxLabel: 'Save to technician directory for future 1-click dispatch',
    deleteModalTitle: 'Remove Technician',
    deleteModalMsg: 'This technician will no longer appear in your quick dispatch list.',
    resolutionActions: [
      { text: '✓ Leaking tap / bibcock / shower valve replaced with new fitting', val: 'Leaking tap / bibcock / shower rose valve replaced with new fitting.' },
      { text: '✓ Washroom / basin drainage blockage cleared and flow restored', val: 'Washroom / basin drainage blockage cleared and water flow fully restored.' },
      { text: '✓ Toilet flush cistern / siphon assembly repaired leak-free', val: 'Toilet flush cistern / siphon assembly repaired and tested leak-free.' },
      { text: '✓ Overhead water tank supply valve opened / airlock released', val: 'Overhead water tank supply valve opened / airlock released; full pressure restored.' },
      { text: '✓ Geyser inlet/outlet pipe connection sealed and verified leak-free', val: 'Geyser inlet/outlet pipe connection sealed and verified leak-free.' },
      { text: '✓ Main wastewater line / sewer gully trap desilted and sanitized', val: 'Main wastewater line blockage / sewer trap desilted and sanitized.' },
      { text: '✓ Inspected on-site with student; water pressure & drainage normal', val: 'Inspected on-site with student; water supply pressure and drainage verified normal.' }
    ]
  },
  Carpentry: {
    department: 'Department of Carpentry & Civil Infrastructure',
    tabLabel: '🪚 Technicians Directory',
    tabIcon: '🪚',
    viewTitle: 'Carpentry & Civil Technicians Directory',
    viewSubtitle: 'Maintain dedicated carpenters and civil infrastructure repair staff covering all campus hostels.',
    btnAddLabel: '➕ Add New Technician',
    selectLabel: '⚡ Select from Available Carpenters',
    choosePlaceholder: '-- Choose Available Carpenter --',
    customOption: '+ Enter Custom / Other Carpenter',
    modalAddTitle: 'Add New Technician',
    modalEditTitle: 'Edit Technician Details',
    modalSub: 'Maintain technician details for instant ticket dispatch across all halls.',
    lblFormName: 'Technician Full Name',
    lblProfName: 'Technician Full Name',
    tableProfColHeader: 'Assigned Carpenter / Tech',
    entityName: 'Technician',
    entityPlural: 'Technicians',
    badgeUnit: 'Available',
    assignModalTitle: 'Assign Carpentry Technician',
    assignModalSub: 'Designate a carpentry technician to service this grievance.',
    saveCheckboxLabel: 'Save to technician directory for future 1-click dispatch',
    deleteModalTitle: 'Remove Technician',
    deleteModalMsg: 'This technician will no longer appear in your quick dispatch list.',
    resolutionActions: [
      { text: '✓ Door mortise lock / cylinder replaced with new key set issued', val: 'Door cylinder lock / mortise lock replaced with new key set issued to resident.' },
      { text: '✓ Almirah / wardrobe hinges, handles and tower bolts repaired', val: 'Almirah / wardrobe hinges, handles and tower bolts repaired and aligned.' },
      { text: '✓ Study desk / chair joints tightened and stability restored', val: 'Study desk / chair joints tightened and structural stability restored.' },
      { text: '✓ Bed frame / wooden base slats repaired and reinforced', val: 'Bed frame / wooden base slats repaired and reinforced.' },
      { text: '✓ Window glass pane, mesh screen or latch secured', val: 'Window glass pane, mesh screen, or wooden latch re-fitted and secured.' },
      { text: '✓ Drawer slide channel lubricated / replaced for smooth gliding', val: 'Drawer slide channel lubricated / replaced for smooth operation.' },
      { text: '✓ Inspected on-site with student; doors, locks & woodwork verified', val: 'Inspected on-site with student; doors, locks and woodwork verified fully functional.' }
    ]
  },
  Food: {
    department: 'Department of Hostel Mess & Food Quality',
    tabLabel: '🍽️ Catering & Mess Staff',
    tabIcon: '🍲',
    viewTitle: 'Hostel Mess & Catering Staff Directory',
    viewSubtitle: 'Maintain dining hall supervisors, kitchen head staff, and hygiene inspectors across all hostel messes.',
    btnAddLabel: '➕ Add New Catering Staff Member',
    selectLabel: '⚡ Select from Catering & Mess Staff',
    choosePlaceholder: '-- Choose Available Mess Staff --',
    customOption: '+ Enter Custom / Other Staff Member',
    modalAddTitle: 'Add New Catering Staff Member',
    modalEditTitle: 'Edit Mess Staff Member Details',
    modalSub: 'Maintain dining hall supervisors and kitchen staff for rapid complaint dispatch.',
    lblFormName: 'Staff Member Full Name',
    lblProfName: 'Assigned Staff / Inspector Full Name',
    tableProfColHeader: 'Assigned Staff / Inspector',
    entityName: 'Staff Member',
    entityPlural: 'Mess Staff Members',
    badgeUnit: 'On Duty',
    assignModalTitle: 'Assign Catering Staff / Food Inspector',
    assignModalSub: 'Designate kitchen staff or food quality inspector to investigate this mess grievance.',
    saveCheckboxLabel: 'Save to mess staff directory for future 1-click dispatch',
    deleteModalTitle: 'Remove Staff Member',
    deleteModalMsg: 'This staff member will no longer appear in your quick dispatch list.',
    resolutionActions: [
      { text: '✓ Meal quality inspected with Head Chef; cooking standards enforced', val: 'Mess meal quality inspected on-site with Head Chef; corrective cooking protocols enforced.' },
      { text: '✓ Dining hall & kitchen utensils deep-cleaned and sanitized', val: 'Dining hall tables, trays and kitchen cooking utensils deep-cleaned and sanitized.' },
      { text: '✓ Drinking water cooler / R.O. filtration serviced and tested safe', val: 'Hostel mess drinking water cooler / R.O. filtration serviced and water safety tested.' },
      { text: '✓ Food serving temperature and timely meal schedule regularized', val: 'Meal serving temperature and timely breakfast/lunch/dinner service regularized.' },
      { text: '✓ Food portioning guidelines & fresh ingredients verified with vendor', val: 'Food portioning guidelines and fresh ingredient sourcing verified with vendor.' },
      { text: '✓ Kitchen staff hygiene, apron and food safety protocols audited', val: 'Kitchen staff personal hygiene, aprons and food handler sanitation protocols audited.' },
      { text: '✓ Student mess committee feedback recorded and verified satisfactory', val: 'Student mess committee feedback recorded and food service verified satisfactory.' }
    ]
  },
  Discipline: {
    department: 'Department of Hostel Discipline & Student Welfare',
    tabLabel: '🛡️ Wardens & Proctors',
    tabIcon: '⚖️',
    viewTitle: 'Hostel Wardens & Proctors Directory',
    viewSubtitle: 'Maintain hostel marshals, assistant wardens, and floor proctors for quiet hours and welfare across all hostels.',
    btnAddLabel: '➕ Add New Proctor / Warden',
    selectLabel: '⚡ Select from Wardens & Proctors',
    choosePlaceholder: '-- Choose Available Proctor / Warden --',
    customOption: '+ Enter Custom / Other Proctor or Warden',
    modalAddTitle: 'Add New Proctor / Warden',
    modalEditTitle: 'Edit Proctor / Warden Details',
    modalSub: 'Maintain student welfare and security personnel across all residential wings.',
    lblFormName: 'Proctor / Warden Full Name',
    lblProfName: 'Assigned Warden / Proctor Full Name',
    tableProfColHeader: 'Assigned Proctor / Warden',
    entityName: 'Proctor / Warden',
    entityPlural: 'Proctors & Wardens',
    badgeUnit: 'On Duty',
    assignModalTitle: 'Assign Proctor / Assistant Warden',
    assignModalSub: 'Designate a hostel proctor or warden to investigate and resolve this matter.',
    saveCheckboxLabel: 'Save to proctors directory for future 1-click dispatch',
    deleteModalTitle: 'Remove Proctor / Warden',
    deleteModalMsg: 'This proctor/warden will no longer appear in your quick dispatch list.',
    resolutionActions: [
      { text: '✓ Roommates / wing residents counseled; harmony restored', val: 'Roommates / wing residents counseled in warden office; mutual understanding and peace restored.' },
      { text: '✓ Silent hours / noise violation warning issued; quiet enforced', val: 'Silent hours / noise disturbance warning issued; quiet study hours strictly enforced.' },
      { text: '✓ Proctorial inquiry conducted on-site; matter amicably settled', val: 'Proctorial inquiry conducted on-site; statements recorded and matter settled.' },
      { text: '✓ Floor proctor / night marshal patrol alerted for enhanced vigil', val: 'Floor proctor and night marshal patrol alerted for enhanced security vigil in wing.' },
      { text: '✓ Gate entry / night attendance record reconciled with warden', val: 'Hostel gate entry / night attendance record reconciled and verified with warden registry.' },
      { text: '✓ Room allocation / bed placement dispute reviewed and resolved', val: 'Room allocation / bed placement dispute reviewed and amicably resolved.' },
      { text: '✓ Student welfare verified in presence of proctor; no escalation', val: 'Student welfare verified in presence of floor proctor; no further grievance or escalation.' }
    ]
  }
};

function getDomainConfig(cat) {
  return DOMAIN_DIRECTORY_CONFIG[cat] || DOMAIN_DIRECTORY_CONFIG.Electrical;
}

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
    const domainCfg = getDomainConfig(currentUser.category);

    const supBrandIconEl = document.getElementById('supBrandIcon');
    if (supBrandIconEl) supBrandIconEl.textContent = cat.icon;

    const supNavSubEl = document.getElementById('supNavSub');
    if (supNavSubEl) supNavSubEl.textContent = `${domainCfg.department} • Integral University Hostels`;

    const supAvatarEl = document.getElementById('supAvatar');
    if (supAvatarEl) supAvatarEl.textContent = cat.icon;

    const supDisplayNameEl = document.getElementById('supDisplayName');
    if (supDisplayNameEl) supDisplayNameEl.textContent = currentUser.name;

    const supDisplayMetaEl = document.getElementById('supDisplayMeta');
    if (supDisplayMetaEl) {
      supDisplayMetaEl.innerHTML = `
        <span style="font-weight:700; color:var(--primary-700);">${domainCfg.department}</span>
        <span style="margin: 0 0.5rem; color: var(--slate-300);">&bull;</span>
        <span>Helpline / Contact: <strong>${currentUser.phone || '+91 94558 96120'}</strong></span>
      `;
    }

    const supQueueTitleEl = document.getElementById('supQueueTitle');
    if (supQueueTitleEl) supQueueTitleEl.textContent = `${currentUser.category || 'Domain'} Complaints Queue`;

    // Dynamic Directory Tab & Header Configuration
    const tabTechsEl = document.getElementById('tabNavTechnicians');
    if (tabTechsEl) {
      const spanLabel = tabTechsEl.querySelector('span:first-child');
      if (spanLabel) spanLabel.textContent = domainCfg.tabLabel;
    }

    const techViewTitleEl = document.getElementById('techViewTitle');
    if (techViewTitleEl) techViewTitleEl.textContent = domainCfg.viewTitle;

    const techViewSubEl = document.getElementById('techViewSub');
    if (techViewSubEl) techViewSubEl.textContent = domainCfg.viewSubtitle;

    const btnAddTechEl = document.getElementById('btnOpenAddTechModal');
    if (btnAddTechEl) btnAddTechEl.innerHTML = domainCfg.btnAddLabel;

    const thProfEl = document.getElementById('thAssignedProfessional');
    if (thProfEl) thProfEl.textContent = domainCfg.tableProfColHeader;

    const lblTechFormNameEl = document.getElementById('lblTechFormName');
    if (lblTechFormNameEl) lblTechFormNameEl.innerHTML = `${domainCfg.lblFormName} <span class="req">*</span>`;

    const lblProfNameEl = document.getElementById('lblProfName');
    if (lblProfNameEl) lblProfNameEl.innerHTML = `${domainCfg.lblProfName} <span class="req">*</span>`;

    const techSelectLabelEl = document.getElementById('techSelectLabel');
    if (techSelectLabelEl) techSelectLabelEl.textContent = domainCfg.selectLabel;

    const chkSaveLabel = document.getElementById('chkSaveTechnicianLabel');
    if (chkSaveLabel) chkSaveLabel.textContent = domainCfg.saveCheckboxLabel;

    const kpiInProgressTitleEl = document.getElementById('kpiTitleInProgress');
    if (kpiInProgressTitleEl) kpiInProgressTitleEl.textContent = `${domainCfg.entityName} On-Site / Active`;

    await Promise.all([fetchComplaints(), fetchTechnicians()]);
  } catch (err) {
    console.error('Supervisor Auth Error:', err);
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

  // Workspace Navigation Tabs (Complaints vs Technicians)
  const tabComplaints = document.getElementById('tabNavComplaints');
  const tabTechs = document.getElementById('tabNavTechnicians');
  if (tabComplaints && tabTechs) {
    tabComplaints.addEventListener('click', () => switchWorkspaceTab('complaints'));
    tabTechs.addEventListener('click', () => switchWorkspaceTab('technicians'));
  }

  // Filter tabs for complaints
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

  // Technician Status Filter
  const techStatusFilter = document.getElementById('techStatusFilter');
  if (techStatusFilter) {
    techStatusFilter.addEventListener('change', (e) => {
      techActiveFilter = e.target.value;
      renderTechnicians();
    });
  }

  // Add / Edit Technician Modal Listeners
  const btnOpenAddTech = document.getElementById('btnOpenAddTechModal');
  if (btnOpenAddTech) btnOpenAddTech.addEventListener('click', openAddTechnicianModal);

  const btnCloseTech = document.getElementById('btnCloseTechModal');
  if (btnCloseTech) btnCloseTech.addEventListener('click', closeTechnicianModal);

  const btnCancelTech = document.getElementById('btnCancelTechModal');
  if (btnCancelTech) btnCancelTech.addEventListener('click', closeTechnicianModal);

  const techForm = document.getElementById('technicianForm');
  if (techForm) techForm.addEventListener('submit', handleSaveTechnician);

  // 1-Click Technician Selector Change in Assign Modal
  const techSelect = document.getElementById('technicianSelect');
  if (techSelect) {
    techSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const profName = document.getElementById('profName');
      const profPhone = document.getElementById('profPhone');
      const profNotes = document.getElementById('profNotes');
      const chkSave = document.getElementById('chkSaveTechnician');

      if (!val) {
        profName.value = '';
        profPhone.value = '';
        if (chkSave) chkSave.checked = false;
        return;
      }

      if (val === '__custom__') {
        profName.value = '';
        profPhone.value = '';
        if (chkSave) chkSave.checked = true;
        profName.focus();
        return;
      }

      const tech = technicians.find(t => t.id === val);
      if (tech) {
        profName.value = tech.name;
        profPhone.value = tech.phone;
        if (chkSave) chkSave.checked = false;
      }
    });
  }

  // Assign Modal
  const btnCloseAssign = document.getElementById('btnCloseAssignModal');
  if (btnCloseAssign) btnCloseAssign.addEventListener('click', () => {
    document.getElementById('assignProfessionalModal').classList.remove('active');
  });
  const btnCancelAssign = document.getElementById('btnCancelAssign');
  if (btnCancelAssign) btnCancelAssign.addEventListener('click', () => {
    document.getElementById('assignProfessionalModal').classList.remove('active');
  });
  const assignForm = document.getElementById('assignProfessionalForm');
  if (assignForm) assignForm.addEventListener('submit', handleAssignProfessional);

  // Resolve Modal
  const btnCloseResolve = document.getElementById('btnCloseResolveModal');
  if (btnCloseResolve) btnCloseResolve.addEventListener('click', () => {
    document.getElementById('resolveTicketModal').classList.remove('active');
  });
  const btnCancelResolve = document.getElementById('btnCancelResolve');
  if (btnCancelResolve) btnCancelResolve.addEventListener('click', () => {
    document.getElementById('resolveTicketModal').classList.remove('active');
  });
  const resolveForm = document.getElementById('resolveTicketForm');
  if (resolveForm) resolveForm.addEventListener('submit', handleResolveTicket);

  // Detail Modal Close
  const btnCloseDetail = document.getElementById('btnCloseDetailModal');
  if (btnCloseDetail) btnCloseDetail.addEventListener('click', () => {
    document.getElementById('ticketDetailModal').classList.remove('active');
  });
  const btnCloseDetailBtn = document.getElementById('btnCloseDetailModalBtn');
  if (btnCloseDetailBtn) btnCloseDetailBtn.addEventListener('click', () => {
    document.getElementById('ticketDetailModal').classList.remove('active');
  });

  // Universal Event Delegation for Assign, Resolve, and View buttons (Table & Cards)
  document.addEventListener('click', (e) => {
    const btnAssign = e.target.closest('.btn-assign');
    if (btnAssign) {
      e.preventDefault();
      const id = btnAssign.dataset.id;
      if (id) openAssignModal(id);
      return;
    }

    const btnResolve = e.target.closest('.btn-resolve');
    if (btnResolve) {
      e.preventDefault();
      const id = btnResolve.dataset.id;
      if (id) openResolveModal(id);
      return;
    }

    const btnView = e.target.closest('.btn-view');
    if (btnView) {
      e.preventDefault();
      const id = btnView.dataset.id;
      if (id) openDetailModal(id);
      return;
    }
  });

  // Delete Technician Modal Listeners
  const btnCloseDel = document.getElementById('btnCloseDeleteTechModal');
  if (btnCloseDel) btnCloseDel.addEventListener('click', closeDeleteTechnicianModal);

  const btnCancelDel = document.getElementById('btnCancelDeleteTech');
  if (btnCancelDel) btnCancelDel.addEventListener('click', closeDeleteTechnicianModal);

  const btnConfirmDel = document.getElementById('btnConfirmDeleteTech');
  if (btnConfirmDel) btnConfirmDel.addEventListener('click', confirmDeleteTechnician);

  // Technician Grid Event Delegation for Delete
  const techGrid = document.getElementById('techniciansGrid');
  if (techGrid) {
    techGrid.addEventListener('click', (e) => {
      const btnDel = e.target.closest('.btn-delete-tech');
      if (btnDel) {
        const id = btnDel.dataset.id;
        if (id) openDeleteTechnicianModal(id);
      }
    });
  }

  // Preset time buttons for datetime-local picker
  document.querySelectorAll('.btn-time-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const preset = btn.dataset.preset || e.currentTarget.dataset.preset;
      if (preset) applyTimePreset(preset);
    });
  });

  // Real-time preview update on manual date-time change
  const profVisitInput = document.getElementById('profVisitTime');
  if (profVisitInput) {
    profVisitInput.addEventListener('input', updateVisitPreview);
    profVisitInput.addEventListener('change', updateVisitPreview);
  }

  // Standard resolution reasons select change listener
  const resolveSelect = document.getElementById('resolveReasonSelect');
  if (resolveSelect) {
    resolveSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const notesEl = document.getElementById('resolutionNotes');
      const labelEl = document.getElementById('labelResolutionNotes');
      if (!val) {
        notesEl.value = '';
        if (labelEl) labelEl.textContent = 'Resolution Remarks & Notes *';
        return;
      }
      if (val === '__other__') {
        notesEl.value = '';
        notesEl.placeholder = 'Type custom resolution remarks and work performed...';
        if (labelEl) labelEl.textContent = 'Custom Resolution Remarks & Actions Taken *';
        notesEl.focus();
        return;
      }
      notesEl.value = val;
      if (labelEl) labelEl.textContent = 'Resolution Remarks (Auto-filled, editable) *';
    });
  }
}

function switchWorkspaceTab(tab) {
  currentWorkspaceTab = tab;
  const tabComplaints = document.getElementById('tabNavComplaints');
  const tabTechs = document.getElementById('tabNavTechnicians');
  const secComplaints = document.getElementById('sectionComplaints');
  const secTechs = document.getElementById('sectionTechnicians');

  if (tab === 'complaints') {
    if (tabComplaints) tabComplaints.classList.add('active');
    if (tabTechs) tabTechs.classList.remove('active');
    if (secComplaints) secComplaints.style.display = 'block';
    if (secTechs) secTechs.style.display = 'none';
  } else {
    if (tabTechs) tabTechs.classList.add('active');
    if (tabComplaints) tabComplaints.classList.remove('active');
    if (secComplaints) secComplaints.style.display = 'none';
    if (secTechs) secTechs.style.display = 'block';
    renderTechnicians();
  }
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
      if (data.type === 'TECHNICIANS_UPDATED') {
        fetchTechnicians();
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
  const currentCategory = currentUser?.category || 'Electrical';
  const domainCfg = getDomainConfig(currentCategory);
  const cat = CATEGORIES[currentCategory] || { icon: '🛠️' };

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
      profCol = `<span style="color:var(--amber-600); font-weight:600; font-size:0.8rem;">⚠️ Needs ${domainCfg.entityName}</span>`;
    }

    let statusBadgeClass = 'status-pending';
    if (t.status === 'Resolved') statusBadgeClass = 'status-resolved';
    else if (t.status === 'In Progress') statusBadgeClass = 'status-progress';
    if (isBreached) statusBadgeClass = 'status-breached';

    let actionButtons = '';
    if (t.status !== 'Resolved') {
      const isAssigned = !!t.assignedProfessional;
      const assignLabel = isAssigned ? '🔄 Reassign' : '🛠️ Assign';
      const assignTitle = isAssigned ? `Reassign or change ${domainCfg.entityName.toLowerCase()}` : `Assign ${domainCfg.entityName.toLowerCase()}`;
      const assignClass = isAssigned ? 'btn btn-outline btn-sm btn-assign' : 'btn btn-primary btn-sm btn-assign';
      actionButtons = `
        <div style="display:flex; gap:0.3rem; align-items:center; white-space:nowrap;">
          <button class="${assignClass}" data-id="${t.id}" title="${assignTitle}" style="padding:0.4rem 0.55rem; font-size:0.76rem;">${assignLabel}</button>
          <button class="btn btn-success btn-sm btn-resolve" data-id="${t.id}" title="Mark resolved" style="padding:0.4rem 0.55rem; font-size:0.76rem;">✓ Resolve</button>
          <button class="btn btn-secondary btn-sm btn-view" data-id="${t.id}" style="padding:0.4rem 0.55rem; font-size:0.76rem;">🔍 View</button>
        </div>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-secondary btn-sm btn-view" data-id="${t.id}" style="padding:0.4rem 0.65rem; font-size:0.76rem;">🔍 Details</button>
      `;
    }

    return `
      <tr class="${rowClass}">
        <td style="width:110px;"><strong style="color:var(--primary-800);">#${t.ticketNumber}</strong></td>
        <td style="max-width:155px; width:155px;">
          <div style="font-weight:600; max-width:155px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(t.studentName)}">${escapeHtml(t.studentName)}</div>
          <div style="font-size:0.73rem; color:var(--primary-700); font-weight:600; max-width:155px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(t.campus || 'Phase I')} &bull; ${escapeHtml(t.hostel)} - Rm ${escapeHtml(t.room)}">${escapeHtml(t.campus || 'Phase I')} &bull; ${escapeHtml(t.hostel)} - Rm ${escapeHtml(t.room)}</div>
        </td>
        <td style="max-width:140px; width:140px;">
          <div style="font-weight:600; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
          <div style="font-size:0.74rem; color:var(--slate-500); max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(t.description)}">${escapeHtml(t.description)}</div>
        </td>
        <td style="width:75px;"><span class="badge-status status-progress" style="font-size:0.72rem;">${t.priority}</span></td>
        <td style="width:130px;">
          <div class="sla-badge-text ${sla.textClass}" style="font-size:0.78rem;">${sla.badgeText}</div>
          <div class="sla-bar" style="width: 90px; margin-top:3px;">
            <div class="sla-bar-fill ${sla.fillClass}" style="width: ${sla.progressPercent}%"></div>
          </div>
        </td>
        <td style="width:160px;">${profCol}</td>
        <td style="width:110px;"><span class="badge-status ${statusBadgeClass}">${t.status}</span></td>
        <td style="width:230px; white-space:nowrap;">${actionButtons}</td>
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
        profText = `<span style="color:var(--amber-600); font-weight:700;">⚠️ Needs ${domainCfg.entityName} Assigned</span>`;
      }

      let statusBadgeClass = 'status-pending';
      if (t.status === 'Resolved') statusBadgeClass = 'status-resolved';
      else if (t.status === 'In Progress') statusBadgeClass = 'status-progress';
      if (isBreached) statusBadgeClass = 'status-breached';

      let cardActions = '';
      if (t.status !== 'Resolved') {
        const isAssigned = !!t.assignedProfessional;
        const assignLabel = isAssigned ? `🔄 Reassign ${domainCfg.entityName}` : `🛠️ Assign ${domainCfg.entityName}`;
        const assignClass = isAssigned ? 'btn btn-outline btn-assign' : 'btn btn-primary btn-assign';
        cardActions = `
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-top:0.75rem;">
            <button class="${assignClass}" data-id="${t.id}" style="padding:0.65rem 0.5rem; font-size:0.82rem; justify-content:center;">${assignLabel}</button>
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
              <div><strong>${escapeHtml(t.campus || 'Phase I')} &bull; ${escapeHtml(t.hostel)}</strong> &bull; Room: <strong>${escapeHtml(t.room)}</strong></div>
            </div>
            <div class="provost-card-row">
              <span>🎓</span>
              <div>Student: <strong>${escapeHtml(t.studentName)}</strong></div>
            </div>
            <div class="provost-card-row">
              <span>${(CATEGORIES[t.category] || cat).icon || '🛠️'}</span>
              <div>${domainCfg.entityName}: ${profText}</div>
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
  document.querySelectorAll('.btn-assign').forEach(b => {
    b.onclick = (e) => {
      e.preventDefault();
      openAssignModal(b.dataset.id);
    };
  });
  document.querySelectorAll('.btn-resolve').forEach(b => {
    b.onclick = (e) => {
      e.preventDefault();
      openResolveModal(b.dataset.id);
    };
  });
  document.querySelectorAll('.btn-view').forEach(b => {
    b.onclick = (e) => {
      e.preventDefault();
      openDetailModal(b.dataset.id);
    };
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

function openAssignModal(ticketId) {
  const ticket = complaints.find(c => c.id === ticketId);
  if (!ticket) return;

  const domainCfg = getDomainConfig(currentUser?.category);
  const isAssigned = !!ticket.assignedProfessional;
  const modalTitle = document.getElementById('assignModalTitle');
  const submitBtn = document.getElementById('btnSubmitAssign');

  if (isAssigned) {
    if (modalTitle) modalTitle.textContent = `🔄 Reassign ${domainCfg.entityName}`;
    document.getElementById('assignModalSubtitle').textContent = `Reassign or change ${domainCfg.entityName.toLowerCase()} for Ticket #${ticket.ticketNumber} [${ticket.category}] (Currently assigned to: ${ticket.assignedProfessional.name})`;
    if (submitBtn) submitBtn.textContent = `Confirm & Reassign ${domainCfg.entityName}`;
  } else {
    if (modalTitle) modalTitle.textContent = domainCfg.assignModalTitle;
    document.getElementById('assignModalSubtitle').textContent = domainCfg.assignModalSub;
    if (submitBtn) submitBtn.textContent = `Confirm & Dispatch ${domainCfg.entityName}`;
  }

  document.getElementById('assignTicketId').value = ticket.id;
  document.getElementById('assignTicketSummaryBanner').innerHTML = `
    <strong>${escapeHtml(ticket.title)}</strong><br>
    <span style="color:var(--slate-500); font-size:0.8rem;">Student: ${escapeHtml(ticket.studentName)} (${escapeHtml(ticket.campus || 'Phase I')} &bull; ${escapeHtml(ticket.hostel)} - Room ${escapeHtml(ticket.room)})</span>
  `;

  // Populate technicianSelect dropdown from saved directory
  const techSelect = document.getElementById('technicianSelect');
  const availCount = technicians.filter(t => t.status === 'Available').length;
  const badgeEl = document.getElementById('techSelectBadge');
  if (badgeEl) badgeEl.textContent = `${availCount} ${domainCfg.badgeUnit}`;

  if (techSelect) {
    let optionsHtml = `<option value="">${domainCfg.choosePlaceholder} (${availCount} ${domainCfg.badgeUnit})</option>`;
    technicians.forEach(t => {
      const isAvail = t.status === 'Available';
      const statusIcon = isAvail ? '🟢' : (t.status === 'Busy' ? '🟠' : '⚪');
      optionsHtml += `<option value="${t.id}">${statusIcon} ${escapeHtml(t.name)} - ${escapeHtml(t.phone)} [${t.status}]</option>`;
    });
    optionsHtml += `<option value="__custom__">${domainCfg.customOption}</option>`;
    techSelect.innerHTML = optionsHtml;

    // If ticket already has assigned professional, try matching
    if (ticket.assignedProfessional?.name) {
      const matched = technicians.find(t => t.name.toLowerCase() === ticket.assignedProfessional.name.toLowerCase());
      if (matched) {
        techSelect.value = matched.id;
      } else {
        techSelect.value = '__custom__';
      }
    } else {
      techSelect.value = '';
    }
  }

  document.getElementById('profName').value = ticket.assignedProfessional?.name || '';
  document.getElementById('profPhone').value = ticket.assignedProfessional?.phone || '';
  
  // Setup Calendar & Clock (datetime-local picker)
  const profVisitInput = document.getElementById('profVisitTime');
  if (profVisitInput) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    profVisitInput.min = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (ticket.assignedProfessional?.expectedVisitTime) {
      profVisitInput.value = parseToDatetimeLocal(ticket.assignedProfessional.expectedVisitTime);
    } else {
      // Default to 1 hour from now rounded to nearest 15 mins
      const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
      defaultDate.setMinutes(Math.ceil(defaultDate.getMinutes() / 15) * 15, 0, 0);
      profVisitInput.value = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth()+1)}-${pad(defaultDate.getDate())}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`;
    }
    updateVisitPreview();
  }

  document.getElementById('profNotes').value = ticket.assignedProfessional?.notes || '';
  
  const chkSave = document.getElementById('chkSaveTechnician');
  if (chkSave) chkSave.checked = false;

  document.getElementById('assignProfessionalModal').classList.add('active');
}

async function handleAssignProfessional(e) {
  e.preventDefault();
  const domainCfg = getDomainConfig(currentUser?.category);
  const ticketId = document.getElementById('assignTicketId').value;
  const techSelect = document.getElementById('technicianSelect');
  const selectedTechId = techSelect && techSelect.value && techSelect.value !== '__custom__' ? techSelect.value : null;
  const chkSave = document.getElementById('chkSaveTechnician');

  const visitRaw = document.getElementById('profVisitTime').value.trim();
  const visitFormatted = formatHumanDateTime(visitRaw);

  const payload = {
    professionalName: document.getElementById('profName').value.trim(),
    professionalPhone: document.getElementById('profPhone').value.trim(),
    expectedVisitTime: visitFormatted,
    notes: document.getElementById('profNotes').value.trim(),
    technicianId: selectedTechId,
    saveToDirectory: chkSave ? chkSave.checked : false
  };

  try {
    const res = await fetch(`/api/complaints/${ticketId}/assign-professional`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to assign professional');
    document.getElementById('assignProfessionalModal').classList.remove('active');
    await Promise.all([fetchComplaints(), fetchTechnicians()]);
    alert(`${domainCfg.entityName} ${payload.professionalName} dispatched successfully! Assigned in MySQL.`);
  } catch (err) {
    alert(err.message);
  }
}

function openResolveModal(ticketId) {
  const ticket = complaints.find(c => c.id === ticketId);
  if (!ticket) return;

  const domain = ticket.category || currentUser?.category || 'Electrical';
  const domainCfg = getDomainConfig(domain);

  document.getElementById('resolveTicketId').value = ticket.id;
  document.getElementById('resolveTicketSummaryBanner').innerHTML = `
    <strong>#${ticket.ticketNumber} - ${escapeHtml(ticket.title)}</strong><br>
    <span style="color:var(--slate-500); font-size:0.8rem;">Category: <strong>${escapeHtml(domain)}</strong> &bull; Student: ${escapeHtml(ticket.studentName)} &bull; ${escapeHtml(ticket.campus || 'Phase I')} &bull; ${escapeHtml(ticket.hostel)} - Room ${escapeHtml(ticket.room)}</span>
  `;

  // Dynamically populate standard resolution actions specific to this department
  const sel = document.getElementById('resolveReasonSelect');
  if (sel) {
    let optionsHtml = `<option value="">-- Select Standard Action (${escapeHtml(domain)}) --</option>`;
    if (domainCfg.resolutionActions && domainCfg.resolutionActions.length > 0) {
      domainCfg.resolutionActions.forEach(act => {
        optionsHtml += `<option value="${escapeHtml(act.val)}">${escapeHtml(act.text)}</option>`;
      });
    }
    optionsHtml += `<option value="__other__">📝 Other (Enter Custom Remarks Manually)</option>`;
    sel.innerHTML = optionsHtml;
    sel.value = '';
  }

  // Reset resolution remarks textarea
  const notes = document.getElementById('resolutionNotes');
  if (notes) {
    notes.value = '';
    notes.placeholder = `Select a standard ${domain} action above or type custom remarks...`;
  }
  const lbl = document.getElementById('labelResolutionNotes');
  if (lbl) lbl.textContent = 'Resolution Remarks & Notes *';

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
      <strong>#${ticket.ticketNumber}</strong> &bull; Student: <strong>${escapeHtml(ticket.studentName)}</strong> (${escapeHtml(ticket.campus || 'Phase I')} &bull; ${escapeHtml(ticket.hostel)} - Room ${escapeHtml(ticket.room)})
    `;

    document.getElementById('modalDescriptionBox').textContent = ticket.description;

    const domain = ticket.category || currentUser?.category || 'Electrical';
    const domainCfg = getDomainConfig(domain);

    const profBox = document.getElementById('modalProfessionalBox');
    const profTitleEl = document.getElementById('lblDetailAssignedProf');
    if (profTitleEl) {
      if (ticket.category === 'Food') profTitleEl.textContent = 'Assigned Catering Staff / Food Inspector';
      else if (ticket.category === 'Discipline') profTitleEl.textContent = 'Assigned Hostel Warden / Floor Proctor';
      else if (ticket.category === 'Plumbing') profTitleEl.textContent = 'Assigned Plumber';
      else if (ticket.category === 'Carpentry') profTitleEl.textContent = 'Assigned Carpenter';
      else profTitleEl.textContent = 'Assigned Electrical Technician';
    }

    if (ticket.assignedProfessional) {
      profBox.innerHTML = `
        <div style="font-weight:700; color:var(--primary-800); font-size:1rem;">
          ${cat.icon || '🛠️'} ${escapeHtml(ticket.assignedProfessional.name)} <span style="font-size:0.8rem; font-weight:600; color:var(--slate-500);">(${domainCfg.entityName})</span>
        </div>
        <div style="margin-top:0.35rem; font-size:0.88rem; color:var(--slate-700);">
          📞 Contact: <strong>${escapeHtml(ticket.assignedProfessional.phone)}</strong><br>
          🕒 Expected Visit: <strong>${escapeHtml(ticket.assignedProfessional.expectedVisitTime)}</strong><br>
          ${ticket.assignedProfessional.notes ? `📝 <em>Instructions: ${escapeHtml(ticket.assignedProfessional.notes)}</em>` : ''}
        </div>
      `;
    } else {
      let notAssignedMsg = 'No field professional assigned yet.';
      if (ticket.category === 'Food') notAssignedMsg = 'No catering staff or food inspector assigned yet.';
      else if (ticket.category === 'Discipline') notAssignedMsg = 'No hostel warden or floor proctor assigned yet.';
      else if (ticket.category === 'Plumbing') notAssignedMsg = 'No plumber assigned yet.';
      else if (ticket.category === 'Carpentry') notAssignedMsg = 'No carpenter assigned yet.';
      else if (ticket.category === 'Electrical') notAssignedMsg = 'No electrical technician assigned yet.';
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
    document.getElementById('modalSlaDeadlineText').textContent = `24h Target: ${new Date(ticket.deadline).toLocaleString()}`;

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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}

// ========================================================
// TECHNICIANS DIRECTORY & MANAGEMENT MODULE
// ========================================================

async function fetchTechnicians() {
  try {
    const res = await fetch('/api/technicians');
    if (!res.ok) throw new Error('Failed to load technicians');
    technicians = await res.json();
    updateTechniciansUI();
  } catch (err) {
    console.error('Failed to load technicians:', err);
  }
}

function updateTechniciansUI() {
  const domainCfg = getDomainConfig(currentUser?.category);
  const availCount = technicians.filter(t => t.status === 'Available').length;
  
  const badgeTechCount = document.getElementById('badgeTechCount');
  if (badgeTechCount) badgeTechCount.textContent = `${availCount} ${domainCfg.badgeUnit}`;

  const badgeComplaints = document.getElementById('badgeComplaintsCount');
  if (badgeComplaints) badgeComplaints.textContent = complaints.length;

  const techSelectBadge = document.getElementById('techSelectBadge');
  if (techSelectBadge) techSelectBadge.textContent = `${availCount} ${domainCfg.badgeUnit}`;

  // Update assign modal dropdown if exists
  const techSelect = document.getElementById('technicianSelect');
  if (techSelect) {
    const curVal = techSelect.value;
    let optionsHtml = `<option value="">${domainCfg.choosePlaceholder} (${availCount} ${domainCfg.badgeUnit})</option>`;
    technicians.forEach(t => {
      const isAvail = t.status === 'Available';
      const statusIcon = isAvail ? '🟢' : (t.status === 'Busy' ? '🟠' : '⚪');
      optionsHtml += `<option value="${t.id}">${statusIcon} ${escapeHtml(t.name)} - ${escapeHtml(t.phone)} [${t.status}]</option>`;
    });
    optionsHtml += `<option value="__custom__">${domainCfg.customOption}</option>`;
    techSelect.innerHTML = optionsHtml;
    if (curVal) techSelect.value = curVal;
  }

  renderTechnicians();
}

function renderTechnicians() {
  const domainCfg = getDomainConfig(currentUser?.category);
  const grid = document.getElementById('techniciansGrid');
  if (!grid) return;

  let list = technicians;
  if (techActiveFilter !== 'all') {
    list = list.filter(t => t.status === techActiveFilter);
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1.5rem; background: #ffffff; border-radius: var(--radius-lg); border: 2px dashed var(--slate-300);">
        <div style="font-size: 2.75rem; margin-bottom: 0.75rem;">${domainCfg.tabIcon}</div>
        <h3 style="font-family: var(--font-heading); font-size: 1.25rem; color: var(--slate-800);">No ${domainCfg.entityPlural} Found</h3>
        <p style="color: var(--slate-500); font-size: 0.88rem; margin: 0.35rem 0 1.25rem;">
          ${techActiveFilter !== 'all' ? `No ${domainCfg.entityPlural.toLowerCase()} matching filter "${techActiveFilter}".` : `No ${domainCfg.entityPlural.toLowerCase()} maintained in your domain directory yet.`}
        </p>
        <button type="button" class="btn btn-primary" onclick="openAddTechnicianModal()">
          ${domainCfg.btnAddLabel}
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(t => {
    const isAvail = t.status === 'Available';
    const isBusy = t.status === 'Busy';
    const isOnLeave = t.status === 'On Leave';

    let statusClass = 'available';
    let statusLabel = `🟢 ${domainCfg.badgeUnit}`;
    if (isBusy) {
      statusClass = 'busy';
      statusLabel = t.activeJobs > 0 ? `🟠 Busy (${t.activeJobs} on-site)` : '🟠 Busy';
    } else if (isOnLeave) {
      statusClass = 'on-leave';
      statusLabel = '⚪ On Leave';
    } else if (t.status === 'Inactive') {
      statusClass = 'inactive';
      statusLabel = '🔴 Inactive';
    }

    const initial = t.name ? t.name.charAt(0).toUpperCase() : 'P';

    return `
      <div class="tech-card">
        <div class="tech-card-header">
          <div class="tech-avatar-wrap">
            <div class="tech-avatar">${initial}</div>
            <div>
              <div class="tech-name">${escapeHtml(t.name)}</div>
              <div style="font-size:0.75rem; color:var(--slate-500);">${domainCfg.entityName}</div>
            </div>
          </div>
          <span class="tech-badge-status ${statusClass}">${statusLabel}</span>
        </div>

        <div class="tech-card-body">
          <div class="tech-info-row">
            <span>📞</span>
            <a href="tel:${escapeHtml(t.phone)}">${escapeHtml(t.phone)}</a>
          </div>
        </div>

        <div class="tech-card-footer">
          <button type="button" class="btn btn-sm btn-outline" onclick="toggleTechnicianStatus('${t.id}', '${t.status}')">
            ${isAvail ? '🟠 Set Busy' : `🟢 Set ${domainCfg.badgeUnit}`}
          </button>
          <div style="display:flex; gap:0.4rem;">
            <button type="button" class="btn btn-sm btn-secondary" onclick="openEditTechnicianModal('${t.id}')">
              ✏️ Edit
            </button>
            <button type="button" class="btn btn-sm btn-outline btn-delete-tech" style="color:#b91c1c; border-color:#fecaca;" data-id="${t.id}" data-name="${escapeHtml(t.name)}" onclick="openDeleteTechnicianModal('${t.id}')">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddTechnicianModal() {
  const domainCfg = getDomainConfig(currentUser?.category);
  const form = document.getElementById('technicianForm');
  if (form) form.reset();
  document.getElementById('editTechId').value = '';
  document.getElementById('techModalTitle').textContent = domainCfg.modalAddTitle;
  document.getElementById('techModalSub').textContent = domainCfg.modalSub;
  const btnSave = document.getElementById('btnSaveTechnician');
  if (btnSave) btnSave.textContent = `Save ${domainCfg.entityName}`;
  document.getElementById('technicianModal').classList.add('active');
  document.getElementById('techFormName').focus();
}

function openEditTechnicianModal(techId) {
  const domainCfg = getDomainConfig(currentUser?.category);
  const tech = technicians.find(t => t.id === techId);
  if (!tech) return;

  document.getElementById('editTechId').value = tech.id;
  document.getElementById('techFormName').value = tech.name;
  document.getElementById('techFormPhone').value = tech.phone;
  document.getElementById('techFormStatus').value = tech.status;

  document.getElementById('techModalTitle').textContent = domainCfg.modalEditTitle;
  document.getElementById('techModalSub').textContent = `Update contact or availability for ${tech.name}.`;
  const btnSave = document.getElementById('btnSaveTechnician');
  if (btnSave) btnSave.textContent = `Update ${domainCfg.entityName}`;
  document.getElementById('technicianModal').classList.add('active');
}

function closeTechnicianModal() {
  document.getElementById('technicianModal').classList.remove('active');
}

async function handleSaveTechnician(e) {
  e.preventDefault();
  const domainCfg = getDomainConfig(currentUser?.category);
  const techId = document.getElementById('editTechId').value;
  const payload = {
    name: document.getElementById('techFormName').value.trim(),
    phone: document.getElementById('techFormPhone').value.trim(),
    status: document.getElementById('techFormStatus').value,
    category: currentUser?.category
  };

  try {
    let res;
    if (techId) {
      res = await fetch(`/api/technicians/${techId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save record');

    closeTechnicianModal();
    await fetchTechnicians();
    alert(`${domainCfg.entityName} ${payload.name} saved successfully!`);
  } catch (err) {
    alert(err.message);
  }
}

async function toggleTechnicianStatus(techId, currentStatus) {
  const newStatus = currentStatus === 'Available' ? 'Busy' : 'Available';
  try {
    const res = await fetch(`/api/technicians/${techId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('Failed to update status');
    await fetchTechnicians();
  } catch (err) {
    alert(err.message);
  }
}

function openDeleteTechnicianModal(techId) {
  const domainCfg = getDomainConfig(currentUser?.category);
  const tech = technicians.find(t => t.id === techId);
  if (!tech) return;
  document.getElementById('deleteTechId').value = tech.id;
  document.getElementById('deleteTechNameDisplay').textContent = tech.name;
  const delTitle = document.getElementById('deleteModalTitle');
  if (delTitle) delTitle.textContent = domainCfg.deleteModalTitle;
  const delWarn = document.getElementById('deleteModalWarning');
  if (delWarn) delWarn.textContent = domainCfg.deleteModalMsg;
  document.getElementById('deleteTechnicianModal').classList.add('active');
}

function closeDeleteTechnicianModal() {
  const modal = document.getElementById('deleteTechnicianModal');
  if (modal) modal.classList.remove('active');
}

async function confirmDeleteTechnician() {
  const domainCfg = getDomainConfig(currentUser?.category);
  const techId = document.getElementById('deleteTechId').value;
  if (!techId) return;

  const tech = technicians.find(t => t.id === techId);
  const techName = tech ? tech.name : domainCfg.entityName;

  const btn = document.getElementById('btnConfirmDeleteTech');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Removing...';
  }

  try {
    const res = await fetch(`/api/technicians/${techId}`, {
      method: 'DELETE'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to remove record');

    closeDeleteTechnicianModal();
    await fetchTechnicians();
    alert(`${domainCfg.entityName} "${techName}" removed from directory.`);
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🗑️ Yes, Remove';
    }
  }
}

// Date & Time Helpers for Calendar & Clock Picker
function parseToDatetimeLocal(str) {
  if (!str) return '';
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  } catch (e) {}
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatHumanDateTime(dtLocalStr) {
  if (!dtLocalStr) return 'Today';
  try {
    const d = new Date(dtLocalStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  } catch (e) {}
  return dtLocalStr;
}

function updateVisitPreview() {
  const profVisitInput = document.getElementById('profVisitTime');
  const previewText = document.getElementById('profVisitFormattedText');
  if (!profVisitInput || !previewText) return;
  const val = profVisitInput.value;
  if (!val) {
    previewText.textContent = 'Please choose date and time above';
    return;
  }
  previewText.textContent = formatHumanDateTime(val);
}

let lastPresetTime = 0;
function applyTimePreset(preset) {
  const nowMs = Date.now();
  if (nowMs - lastPresetTime < 200) return;
  lastPresetTime = nowMs;

  const profVisitInput = document.getElementById('profVisitTime');
  if (!profVisitInput) return;
  const pad = n => String(n).padStart(2, '0');

  const now = new Date();
  let baseDate = null;

  // 1. Try reading the currently selected date/time in the input
  const currentVal = profVisitInput.value;
  if (currentVal && currentVal.includes('T')) {
    const [datePart, timePart] = currentVal.split('T');
    if (datePart && timePart) {
      const [y, m, d] = datePart.split('-').map(Number);
      const [h, min] = timePart.split(':').map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d) && !isNaN(h) && !isNaN(min)) {
        baseDate = new Date(y, m - 1, d, h, min, 0);
      }
    }
  }

  // Helper to format Date to YYYY-MM-DDTHH:mm
  const toLocalString = (d) => {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (preset === '1h' || preset === '2h') {
    const hoursToAdd = preset === '1h' ? 1 : 2;

    // If current value is missing, invalid, or earlier than right now, base it on now
    if (!baseDate || isNaN(baseDate.getTime()) || baseDate.getTime() < now.getTime()) {
      baseDate = new Date(now.getTime());
      // Round up to nearest 15 minutes
      baseDate.setMinutes(Math.ceil(baseDate.getMinutes() / 15) * 15, 0, 0);
      baseDate.setHours(baseDate.getHours() + hoursToAdd);
    } else {
      // Advance by 1 or 2 hours from the currently chosen time
      baseDate.setHours(baseDate.getHours() + hoursToAdd);
    }

    profVisitInput.value = toLocalString(baseDate);
  } else if (preset === 'today_pm') {
    // Set to today 3:00 PM; if already past 3 PM, set to today 5:00 PM; if past 5 PM, set to tomorrow 3:00 PM
    const target = new Date();
    target.setHours(15, 0, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setHours(17, 0, 0, 0);
    }
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
      target.setHours(15, 0, 0, 0);
    }
    profVisitInput.value = toLocalString(target);
  } else if (preset === 'tomorrow_am') {
    // Set to tomorrow at 10:00 AM
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(10, 0, 0, 0);
    profVisitInput.value = toLocalString(target);
  }

  // Update real-time text preview
  updateVisitPreview();

  // Visual pulse feedback on input to confirm time changed
  profVisitInput.style.transition = 'box-shadow 0.2s ease, border-color 0.2s ease';
  profVisitInput.style.borderColor = '#2563eb';
  profVisitInput.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.25)';
  setTimeout(() => {
    profVisitInput.style.borderColor = '';
    profVisitInput.style.boxShadow = '';
  }, 350);
}

// Fallback alias
function deleteTechnician(techId) {
  openDeleteTechnicianModal(techId);
}

// Global exposure for inline onclick attributes
window.openAddTechnicianModal = openAddTechnicianModal;
window.openEditTechnicianModal = openEditTechnicianModal;
window.toggleTechnicianStatus = toggleTechnicianStatus;
window.openDeleteTechnicianModal = openDeleteTechnicianModal;
window.closeDeleteTechnicianModal = closeDeleteTechnicianModal;
window.confirmDeleteTechnician = confirmDeleteTechnician;
window.deleteTechnician = deleteTechnician;
window.applyTimePreset = applyTimePreset;
window.updateVisitPreview = updateVisitPreview;


