const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./dev.db');

db.get("SELECT email, role FROM users WHERE role='admin' LIMIT 1", (err, row) => {
  if (err) {
    console.log('Error:', err.message);
  } else {
    console.log('Admin user:', row);
  }
  
  // También ver las credenciales SUNAT
  db.get("SELECT * FROM credentials WHERE companyId=1 LIMIT 1", (err2, cred) => {
    if (err2) {
      console.log('Error credentials:', err2.message);
    } else {
      console.log('\nSUNAT credentials:', cred);
    }
    db.close();
  });
});
