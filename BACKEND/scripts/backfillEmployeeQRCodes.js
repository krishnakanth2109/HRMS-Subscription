import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../models/employeeModel.js';
import { generateAndUploadQRCode } from '../utils/qrCodeHelper.js';

dotenv.config();

const backfillQRCodes = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected");

    const employees = await Employee.find({
      $or: [{ qrCodeUrl: { $exists: false } }, { qrCodeUrl: null }]
    });

    console.log(`Found ${employees.length} employees needing QR codes.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      console.log(`[${i + 1}/${employees.length}] Processing ${employee.employeeId} (${employee.name})...`);

      if (!employee.company) {
        console.warn(`⚠️ Skipped ${employee.employeeId}: Missing company reference.`);
        failCount++;
        continue;
      }

      try {
        const qrUrl = await generateAndUploadQRCode(employee, employee.company);
        
        if (qrUrl) {
          employee.qrCodeUrl = qrUrl;
          await employee.save();
          console.log(`✅ Success ${employee.employeeId}: ${qrUrl}`);
          successCount++;
        } else {
          console.error(`❌ Failed to generate/upload for ${employee.employeeId}`);
          failCount++;
        }
      } catch (err) {
        console.error(`❌ Error processing ${employee.employeeId}:`, err);
        failCount++;
      }
    }

    console.log("=========================================");
    console.log(`Backfill Complete!`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed/Skipped: ${failCount}`);
    console.log("=========================================");

  } catch (error) {
    console.error("❌ Fatal Error:", error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

backfillQRCodes();
