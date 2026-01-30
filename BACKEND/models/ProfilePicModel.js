// --- START OF FILE models/ProfilePicModel.js ---
import mongoose from 'mongoose';

const profilePicSchema = new mongoose.Schema(
  {
    // HIERARCHY LINKS
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    profilePhoto: {
      public_id: { type: String, required: false },
      url: { type: String, required: false },
    },
  },
  {
    timestamps: true,
  }
);

profilePicSchema.methods.getPublicProfile = function () {
  return {
    employeeId: this.employeeId,
    name: this.name,
    email: this.email,
    phone: this.phone,
    profilePhoto: this.profilePhoto,
  };
};

const ProfilePic = mongoose.model('ProfilePic', profilePicSchema);

export default ProfilePic;