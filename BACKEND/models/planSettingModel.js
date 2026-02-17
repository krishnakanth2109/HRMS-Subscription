import mongoose from "mongoose";

const planSettingSchema = new mongoose.Schema({
  planName: { 
    type: String, 
    unique: true, 
    required: true 
  },
  durationDays: { type: Number, default: 30 },
  price: { type: Number, default: 0 },
  features: [{ type: String }]
});

const PlanSetting = mongoose.model("PlanSetting", planSettingSchema);
export default PlanSetting;