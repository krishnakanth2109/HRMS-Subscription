import mongoose from "mongoose";
import dotenv from "dotenv";
import ProfilePic from "../models/ProfilePicModel.js";

dotenv.config({ path: ".env" });

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const pic = await ProfilePic.findOne({ email: 'kkanth355@gmail.com' });
  console.log('ProfilePic:', pic);
  process.exit(0);
}
test();
