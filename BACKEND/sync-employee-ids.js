import mongoose from "mongoose";
import dotenv from "dotenv";
import Employee from "./models/employeeModel.js";
import Company from "./models/CompanyModel.js";

dotenv.config();

const syncEmployeeIds = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Database Connected for Sync");

        const companies = await Company.find();
        console.log(`Found ${companies.length} companies to sync.`);

        for (const company of companies) {
            console.log(`\n🔄 Syncing Company: ${company.name} (${company.prefix})`);

            // 1. Fetch all employees for this company, sorted by their creation date (or current ID)
            // Sorting by createdAt ensures the oldest employees get the smallest IDs
            const employees = await Employee.find({ company: company._id }).sort({ createdAt: 1 });

            console.log(`   Found ${employees.length} employees.`);

            // 2. Re-assign IDs sequentially starting from 1
            let count = 0;
            for (const emp of employees) {
                count++;
                const paddedCount = String(count).padStart(2, "0");
                const newId = `${company.prefix}${paddedCount}`;

                if (emp.employeeId !== newId) {
                    console.log(`   ✏️ Updating ${emp.name}: ${emp.employeeId} -> ${newId}`);
                    emp.employeeId = newId;
                    await emp.save();
                } else {
                    // console.log(`   ✅ ${emp.name} already has correct ID: ${newId}`);
                }
            }

            // 3. Update company employeeCount
            if (company.employeeCount !== count) {
                console.log(`   📊 Updating Company Count: ${company.employeeCount} -> ${count}`);
                company.employeeCount = count;
                await company.save();
            } else {
                console.log(`   ✅ Company count matches: ${count}`);
            }
        }

        console.log("\n✨ Employee ID Synchronization Complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error running sync:", error);
        process.exit(1);
    }
};

syncEmployeeIds();
