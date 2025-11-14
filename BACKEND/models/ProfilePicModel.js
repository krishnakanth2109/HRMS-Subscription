import mongoose from 'mongoose';

const profilePicSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      // REMOVED: index: true (to prevent duplicate index warning)
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
      public_id: {
        type: String,
        required: false,
      },
      url: {
        type: String,
        required: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes separately (prevents duplicate warning)
profilePicSchema.index({ employeeId: 1 });
profilePicSchema.index({ email: 1 });

// Instance method to get public profile data
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