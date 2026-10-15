import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[0-9+()\- ]{7,20}$/, 'Please provide a valid phone number']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false // Never include password hash in query results by default
    },
    role: {
      type: String,
      enum: {
        values: ['CUSTOMER', 'OWNER', 'ADMIN'],
        message: 'Role must be either CUSTOMER, OWNER, or ADMIN'
      },
      default: 'CUSTOMER'
    },
    accountStatus: {
      type: String,
      enum: {
        values: ['ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED'],
        message: 'Invalid account status'
      },
      default: 'ACTIVE'
    }
  },
  {
    timestamps: true
  }
);

/**
 * Compare plain candidate password with stored bcrypt hash
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Static method to hash password
 */
userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

/**
 * Transform output to remove passwordHash and internal version
 */
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

const User = mongoose.model('User', userSchema);

export default User;
