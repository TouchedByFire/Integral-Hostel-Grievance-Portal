const { getPool, initDatabase } = require('../db.js');

async function migrate() {
  await initDatabase();
  const pool = getPool();
  await pool.query(`
    UPDATE timeline_events t
    JOIN complaints c ON t.complaint_id = c.id
    SET t.action = REPLACE(t.action, 'Assigned technician:', 'Assigned catering staff / food inspector:')
    WHERE c.category = 'Food' AND t.action LIKE '%Assigned technician:%';
  `);
  await pool.query(`
    UPDATE timeline_events t
    JOIN complaints c ON t.complaint_id = c.id
    SET t.action = REPLACE(t.action, 'Assigned technician:', 'Assigned hostel warden / proctor:')
    WHERE c.category = 'Discipline' AND t.action LIKE '%Assigned technician:%';
  `);
  await pool.query(`
    UPDATE timeline_events t
    JOIN complaints c ON t.complaint_id = c.id
    SET t.action = REPLACE(t.action, 'Assigned technician:', 'Assigned plumber:')
    WHERE c.category = 'Plumbing' AND t.action LIKE '%Assigned technician:%';
  `);
  await pool.query(`
    UPDATE timeline_events t
    JOIN complaints c ON t.complaint_id = c.id
    SET t.action = REPLACE(t.action, 'Assigned technician:', 'Assigned carpenter:')
    WHERE c.category = 'Carpentry' AND t.action LIKE '%Assigned technician:%';
  `);
  await pool.query(`
    UPDATE timeline_events t
    JOIN complaints c ON t.complaint_id = c.id
    SET t.action = REPLACE(t.action, 'Assigned technician:', 'Assigned electrical technician:')
    WHERE c.category = 'Electrical' AND t.action LIKE '%Assigned technician:%';
  `);

  console.log('✓ Successfully migrated timeline_events actions.');
  const [rows] = await pool.query('SELECT t.id, c.category, t.action FROM timeline_events t JOIN complaints c ON t.complaint_id = c.id WHERE t.action LIKE "%Assigned%"');
  console.log('Updated events:', JSON.stringify(rows, null, 2));
  process.exit(0);
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
