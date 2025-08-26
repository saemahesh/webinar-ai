const bcrypt = require('bcryptjs');

// Hash the admin password
const hashPassword = async () => {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Hashed password for admin123:', hash);
};

hashPassword();
