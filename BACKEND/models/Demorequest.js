import mongoose from "mongoose";

const demoRequestSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^\+?[\d\s\-().]{7,20}$/, "Please enter a valid phone number"],
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: [150, "Company name cannot exceed 150 characters"],
    },

    // ✅ Stores the actual selected date + time as a Date object
    preferredDemoTime: {
      type: Date,
      required: [true, "Preferred demo date and time is required"],
      validate: {
        validator: (v) => v instanceof Date && v > new Date(),
        message:   "Preferred demo time must be a future date and time",
      },
    },

    message: {
      type: String,
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "scheduled", "completed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const DemoRequest = mongoose.model("DemoRequest", demoRequestSchema);
export default DemoRequest;