
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms').then(async () => {
  const adminSchema = new mongoose.Schema({}, { strict: false });
  const Admin = mongoose.model('Admin', adminSchema, 'admins');
  
  const admin = await Admin.findOne({ email: 'hr@marcamor.com' });
  if (admin) {
    console.log('Current plan details:', admin.planDetails);
    
    // Fix limit if it is 78
    if (admin.planDetails && admin.planDetails.maxUsers === 78) {
      await Admin.updateOne(
        { email: 'hr@marcamor.com' },
        { $set: { 'planDetails.maxUsers': 39 } }
      );
      console.log('Successfully updated maxUsers to 39');
    } else {
      console.log('User limit is not 78, no changes made');
    }
  } else {
    console.log('Admin not found');
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

