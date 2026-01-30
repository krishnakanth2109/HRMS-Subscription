import mongoose from 'mongoose';
import Company from './models/CompanyModel.js';
import Employee from './models/employeeModel.js';
import dotenv from 'dotenv';

dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Find VSA company
    const vsaCompany = await Company.findOne({ prefix: 'VSA' });
    console.log('VSA Company:', vsaCompany);

    // Get all employees with VSA prefix
    const vsaEmployees = await Employee.find({ employeeId: /^VSA/ });
    console.log(`\nEmployees with VSA prefix: ${vsaEmployees.length}`);
    vsaEmployees.forEach((emp, i) => {
      console.log(`  ${i + 1}. ${emp.employeeId} - ${emp.name}`);
    });

    // Get all employees with company field matching VSA
    if (vsaCompany) {
      const vsaByCompany = await Employee.find({ company: vsaCompany._id });
      console.log(`\nEmployees with company.company = VSA._id: ${vsaByCompany.length}`);
      vsaByCompany.forEach((emp, i) => {
        console.log(`  ${i + 1}. ${emp.employeeId} - ${emp.name}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();
