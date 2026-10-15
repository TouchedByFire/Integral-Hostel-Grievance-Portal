/**
 * Re-seed Supervisors, Domain Personnel Directories, and Complaints Mapping
 * According to official Integral University staff roster specifications:
 * - Electrical: Mohd Aamir Khan (maamirk@iul.ac.in / amir@iul.ac.in)
 * - Plumbing: Zahid Raza (zahidraza@iul.ac.in / zahid@iul.ac.in)
 * - Carpentry: Dr. Irfan Ahmad Siddiqui (iasiddiqui@iul.ac.in / irfan@iul.ac.in)
 * - Food: Dr. Salman (salman@iul.ac.in / drsalman@iul.ac.in)
 * - Discipline: Dr. Saba (saba@iul.ac.in / drsaba@iul.ac.in)
 */

const { initDatabase, getPool } = require('../db');

async function main() {
  await initDatabase();
  const pool = getPool();
  console.log('🔄 Re-mapping supervisors and domain directories...');

  // 1. Remove old supervisor records and insert updated domain supervisors
  const supervisors = [
    {
      id: 'usr_sup_aamir',
      role: 'supervisor',
      category: 'Electrical',
      name: 'Mohd Aamir Khan',
      email: 'maamirk@iul.ac.in',
      password: 'password123',
      phone: '+91 94558 96120',
      title: 'Supervisor - Department of Electrical & Power Maintenance',
      empCode: 'A00310'
    },
    {
      id: 'usr_sup_aamir_alias',
      role: 'supervisor',
      category: 'Electrical',
      name: 'Mohd Aamir Khan',
      email: 'amir@iul.ac.in',
      password: 'password123',
      phone: '+91 94558 96120',
      title: 'Supervisor - Department of Electrical & Power Maintenance',
      empCode: 'A00310'
    },
    {
      id: 'usr_sup_zahid',
      role: 'supervisor',
      category: 'Plumbing',
      name: 'Zahid Raza',
      email: 'zahidraza@iul.ac.in',
      password: 'password123',
      phone: '+91 82998 99297',
      title: 'Supervisor - Department of Plumbing & Water Sanitation',
      empCode: 'A00219'
    },
    {
      id: 'usr_sup_zahid_alias',
      role: 'supervisor',
      category: 'Plumbing',
      name: 'Zahid Raza',
      email: 'zahid@iul.ac.in',
      password: 'password123',
      phone: '+91 82998 99297',
      title: 'Supervisor - Department of Plumbing & Water Sanitation',
      empCode: 'A00219'
    },
    {
      id: 'usr_sup_irfan',
      role: 'supervisor',
      category: 'Carpentry',
      name: 'Dr. Irfan Ahmad Siddiqui',
      email: 'iasiddiqui@iul.ac.in',
      password: 'password123',
      phone: '+91 98383 26547',
      title: 'Supervisor - Department of Carpentry & Civil Infrastructure',
      empCode: 'A00325'
    },
    {
      id: 'usr_sup_irfan_alias',
      role: 'supervisor',
      category: 'Carpentry',
      name: 'Dr. Irfan Ahmad Siddiqui',
      email: 'irfan@iul.ac.in',
      password: 'password123',
      phone: '+91 98383 26547',
      title: 'Supervisor - Department of Carpentry & Civil Infrastructure',
      empCode: 'A00325'
    },
    {
      id: 'usr_sup_salman',
      role: 'supervisor',
      category: 'Food',
      name: 'Dr. Salman',
      email: 'salman@iul.ac.in',
      password: 'password123',
      phone: '+91 98399 01234',
      title: 'Supervisor - Department of Hostel Mess & Food Quality',
      empCode: 'A00512'
    },
    {
      id: 'usr_sup_salman_alias',
      role: 'supervisor',
      category: 'Food',
      name: 'Dr. Salman',
      email: 'drsalman@iul.ac.in',
      password: 'password123',
      phone: '+91 98399 01234',
      title: 'Supervisor - Department of Hostel Mess & Food Quality',
      empCode: 'A00512'
    },
    {
      id: 'usr_sup_saba',
      role: 'supervisor',
      category: 'Discipline',
      name: 'Dr. Saba',
      email: 'saba@iul.ac.in',
      password: 'password123',
      phone: '+91 98401 23456',
      title: 'Proctor - Department of Hostel Discipline & Student Welfare',
      empCode: 'A00525'
    },
    {
      id: 'usr_sup_saba_alias',
      role: 'supervisor',
      category: 'Discipline',
      name: 'Dr. Saba',
      email: 'drsaba@iul.ac.in',
      password: 'password123',
      phone: '+91 98401 23456',
      title: 'Proctor - Department of Hostel Discipline & Student Welfare',
      empCode: 'A00525'
    }
  ];

  // Delete previous supervisor records to avoid stale mappings
  await pool.query(`DELETE FROM users WHERE role = 'supervisor'`);

  for (const s of supervisors) {
    await pool.query(`
      INSERT INTO users (id, role, category, name, email, password, phone, title, emp_code, campus, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'All Hostels', 'N/A')
    `, [s.id, s.role, s.category, s.name, s.email, s.password, s.phone, s.title, s.empCode]);
  }
  console.log('✓ Updated official supervisor accounts in MySQL.');

  // 2. Clear and Reseed domain-appropriate personnel directories
  await pool.query(`DELETE FROM technicians`);

  const personnelList = [
    // Electrical (Amir)
    { id: 'tech_elec_1', supId: 'usr_sup_aamir', cat: 'Electrical', name: 'Ramesh Kumar', phone: '+91 98391 23456', status: 'Available' },
    { id: 'tech_elec_2', supId: 'usr_sup_aamir', cat: 'Electrical', name: 'Afzal Khan', phone: '+91 98392 34567', status: 'Available' },
    { id: 'tech_elec_3', supId: 'usr_sup_aamir', cat: 'Electrical', name: 'Sunil Rawat', phone: '+91 98393 45678', status: 'Busy' },

    // Plumbing (Zahid)
    { id: 'tech_plumb_1', supId: 'usr_sup_zahid', cat: 'Plumbing', name: 'Suresh Patel', phone: '+91 98394 56789', status: 'Available' },
    { id: 'tech_plumb_2', supId: 'usr_sup_zahid', cat: 'Plumbing', name: 'Imran Ali', phone: '+91 98395 67890', status: 'Available' },
    { id: 'tech_plumb_3', supId: 'usr_sup_zahid', cat: 'Plumbing', name: 'Dinesh Yadav', phone: '+91 98396 78901', status: 'Available' },

    // Carpentry (Irfan)
    { id: 'tech_carp_1', supId: 'usr_sup_irfan', cat: 'Carpentry', name: 'Master Aslam', phone: '+91 98397 89012', status: 'Available' },
    { id: 'tech_carp_2', supId: 'usr_sup_irfan', cat: 'Carpentry', name: 'Vikas Verma', phone: '+91 98398 90123', status: 'Available' },
    { id: 'tech_carp_3', supId: 'usr_sup_irfan', cat: 'Carpentry', name: 'Nafees Ahmad', phone: '+91 98399 11223', status: 'Available' },

    // Food (Dr. Salman) - Catering & Mess Personnel
    { id: 'staff_food_1', supId: 'usr_sup_salman', cat: 'Food', name: 'Chef Qadir Ahmad', phone: '+91 98399 01234', status: 'Available' },
    { id: 'staff_food_2', supId: 'usr_sup_salman', cat: 'Food', name: 'Naeem Khan', phone: '+91 98400 12345', status: 'Available' },
    { id: 'staff_food_3', supId: 'usr_sup_salman', cat: 'Food', name: 'Shakeel Akhtar', phone: '+91 98403 45678', status: 'Available' },

    // Discipline (Dr. Saba) - Proctors & Marshals
    { id: 'staff_disc_1', supId: 'usr_sup_saba', cat: 'Discipline', name: 'Mahendra Singh', phone: '+91 98401 23456', status: 'Available' },
    { id: 'staff_disc_2', supId: 'usr_sup_saba', cat: 'Discipline', name: 'Shakeel Ahmad', phone: '+91 98402 34567', status: 'Available' },
    { id: 'staff_disc_3', supId: 'usr_sup_saba', cat: 'Discipline', name: 'Rehana Bano', phone: '+91 98405 67890', status: 'Available' }
  ];

  for (const p of personnelList) {
    await pool.query(`
      INSERT INTO technicians (id, supervisor_id, category, name, phone, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [p.id, p.supId, p.cat, p.name, p.phone, p.status]);
  }
  console.log(`✓ Seeded ${personnelList.length} domain personnel records (technicians, mess staff, proctors).`);

  // 3. Update existing complaints to point to the newly assigned supervisors
  const categorySupervisorMap = {
    Electrical: { id: 'usr_sup_aamir', name: 'Mohd Aamir Khan' },
    Plumbing: { id: 'usr_sup_zahid', name: 'Zahid Raza' },
    Carpentry: { id: 'usr_sup_irfan', name: 'Dr. Irfan Ahmad Siddiqui' },
    Food: { id: 'usr_sup_salman', name: 'Dr. Salman' },
    Discipline: { id: 'usr_sup_saba', name: 'Dr. Saba' }
  };

  for (const [category, sup] of Object.entries(categorySupervisorMap)) {
    await pool.query(`
      UPDATE complaints 
      SET assigned_supervisor_id = ?, assigned_supervisor_name = ?
      WHERE category = ?
    `, [sup.id, sup.name, category]);
  }
  console.log('✓ Successfully mapped all existing complaints to designated supervisors.');

  console.log('✅ Done! All supervisors, directories, and tickets mapped perfectly.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during re-seeding:', err);
  process.exit(1);
});
