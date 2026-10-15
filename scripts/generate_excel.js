const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const jsonPath = path.join(__dirname, '..', 'data', 'hostel_residents.json');
const excelPath = path.join(__dirname, '..', 'data', 'hostel_residents.xlsx');

const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Format for Excel file
const excelRows = rawData.map(r => ({
  'S.No.': r.sNo,
  'Enrollment No.': r.enrollmentNo,
  'Name': r.name,
  'Gender': r.gender,
  'Campus': r.campus,
  'Hostel Name': r.hostel,
  'Room No.': r.room,
  'Course': r.course,
  'Mobile No.': r.mobile
}));

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(excelRows);
XLSX.utils.book_append_sheet(wb, ws, 'Hostel Residents');
XLSX.writeFile(wb, excelPath);

console.log(`Successfully generated Excel file at: ${excelPath} with ${excelRows.length} resident records.`);
