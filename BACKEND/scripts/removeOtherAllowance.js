// Script to remove otherAllowance field from all PayrollRecord and PayrollRule documents in MongoDB
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error('❌ No MONGO_URI found in environment variables.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Remove from PayrollRecord (breakdown + monthlyBreakdown)
  const recordResult = await mongoose.connection.db.collection('payrollrecords').updateMany(
    {},
    {
      $unset: {
        'breakdown.otherAllowance': '',
        'monthlyBreakdown.otherAllowance': ''
      }
    }
  );
  console.log(`✅ PayrollRecords updated: ${recordResult.modifiedCount} documents`);

  // Remove from PayrollRule
  const ruleResult = await mongoose.connection.db.collection('payrollrules').updateMany(
    {},
    {
      $unset: {
        'otherAllowance': '',
        'customLabels.otherAllowance': '',
        'otherAllowanceValueType': ''
      }
    }
  );
  console.log(`✅ PayrollRules updated: ${ruleResult.modifiedCount} documents`);

  await mongoose.disconnect();
  console.log('✅ Done. Disconnected from MongoDB.');
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
