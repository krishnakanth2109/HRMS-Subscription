import mongoose from 'mongoose';
import Company from './models/CompanyModel.js';
import Employee from './models/employeeModel.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAndFixCompanies() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all companies
    const companies = await Company.find();
    
    for (const company of companies) {
      // Count employees for this company
      const count = await Employee.countDocuments({ company: company._id });
      
      console.log(`\n${company.name} (${company.prefix}):`);
      console.log(`  Current employeeCount in DB: ${company.employeeCount}`);
      console.log(`  Actual employees with this company: ${count}`);
      
      if (company.employeeCount !== count) {
        console.log(`  ⚠️  MISMATCH! Fixing...`);
        company.employeeCount = count;
        await company.save();
        console.log(`  ✅ Updated to ${count}`);
      } else {
        console.log(`  ✅ Correct`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAndFixCompanies();
