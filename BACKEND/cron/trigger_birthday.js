import mongoose from "mongoose";
import dotenv from "dotenv";
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";
import ProfilePic from "../models/ProfilePicModel.js";
import customTransporter from "../config/nodemailer.js";

dotenv.config({ path: ".env" });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("🎂 Running Manual Birthday Job...");

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const searchString = `-${month}-${day}`;

  const birthdayEmployees = await Employee.find({
    "personalDetails.dob": { $regex: `${searchString}$` }
  });

  if (birthdayEmployees.length === 0) {
    console.log(`No birthdays found for today (${searchString}).`);
    process.exit(0);
  }

  console.log(`Found ${birthdayEmployees.length} birthdays today!`);

  for (const emp of birthdayEmployees) {
    if (!emp.email) continue;
    // Get Company Name directly from the Employee document
    const companyName = emp.companyName || "Your Company";

    // Fetch Profile Picture
    const profileData = await ProfilePic.findOne({ employeeId: emp.employeeId });
    const profilePicUrl = profileData?.profilePhoto?.url || emp.profileImageUrl;

    const profileImageHtml = profilePicUrl 
      ? `<img src="${profilePicUrl}" alt="${emp.name}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin: 0 auto 20px auto; display: block;" />`
      : ``;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f3ed;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #f0e6d2; overflow: hidden; padding-top: 40px;">
          
          <!-- Header Section -->
          <div style="text-align: center; padding: 20px 40px;">
            ${profileImageHtml}
            <h1 style="color: #901f31; font-size: 42px; margin: 0 0 10px 0; font-weight: 800; line-height: 1.1;">Happy<br/>Birthday!</h1>
            <h3 style="color: #a7283d; font-size: 18px; margin: 0 0 20px 0; font-weight: 600; text-transform: capitalize;">Wishing You a Wonderful Celebration, ${emp.name}</h3>
            
            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
              We are thrilled to celebrate you today! Thank you for all your hard work, dedication, and the positive energy you bring to the team. 
              May your special day be filled with joy, laughter, and wonderful memories.
            </p>

            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
              Wishing you a very Happy Birthday from all of us at <strong>${companyName}</strong>! Here's to another year of great achievements and success!
            </p>

            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; background-color: #f75574; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; font-size: 15px;">Login to HRMS</a>
          </div>

          <!-- Decorative Cake Image Section -->
          <div style="text-align: center; margin-top: 20px;">
            <img src="https://images.unsplash.com/photo-1558636508-e0db3814bd1d?q=80&w=800&auto=format&fit=crop" alt="Birthday Cake" style="width: 100%; max-width: 600px; display: block; border-top-left-radius: 50%; border-top-right-radius: 50%; box-shadow: 0 -10px 20px rgba(0,0,0,0.05);" />
          </div>
          
          <!-- Footer Section -->
          <div style="background-color: #ffffff; padding: 30px 20px; text-align: center;">
            <div style="margin-bottom: 15px;">
              <span style="color: #901f31; font-weight: bold; font-size: 16px;">${companyName}</span>
            </div>
            <p style="color: #999999; font-size: 11px; margin: 0;">
              This is an automated message from your HRMS System.
            </p>
          </div>

        </div>
      </body>
      </html>
    `;

    await customTransporter.sendMail({
      from: `"HRMS System" <${process.env.SMTP_USER}>`,
      to: emp.email,
      subject: `🎉 Happy Birthday, ${emp.name}!`,
      html: htmlContent,
      skipAdminOverride: true
    });

    console.log(`✅ Birthday email sent to ${emp.email} (${emp.name})`);
  }
  process.exit(0);
}
run();
