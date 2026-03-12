import mongoose from "mongoose";

const featureSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
  },
  route: {
    type: String,
    required: true,
    unique: true,
  },
  iconKey: {
    type: String,
    default: "",
  },
  description: {
    type: String,
    default: "",
  },
});

const Feature = mongoose.model("Feature", featureSchema);
export default Feature;
