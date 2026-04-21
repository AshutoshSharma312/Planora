const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../utils/email');

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Generate JWT token
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ================= REGISTER =================
exports.register = async (req, res) => {
    try {
        console.log("REQUEST BODY:", req.body); // Debug

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'user',
            isVerified: false
        });

        const otp = generateOTP();

        // ✅ DEBUG OTP
        console.log("Generated OTP:", otp);

        // Save OTP in DB
        await OTP.create({ email, otp, action: 'account_verification' });

        // Send Email
        try {
            await sendOTPEmail(email, otp, 'account_verification');
            console.log("✅ Email sent successfully");
        } catch (err) {
            console.log("❌ EMAIL ERROR:", err.message);
        }

        res.status(201).json({
            message: 'OTP sent to email. Please verify.',
            email: user.email
        });

    } catch (error) {
        console.log("❌ SERVER ERROR:", error.message);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ================= LOGIN =================
exports.login = async (req, res) => {
    try {
        console.log("LOGIN BODY:", req.body); // Debug

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        // If not verified → resend OTP
        if (!user.isVerified && user.role !== 'admin') {
            const otp = generateOTP();

            console.log("Resent OTP:", otp);

            await OTP.findOneAndDelete({ email: user.email, action: 'account_verification' });
            await OTP.create({ email: user.email, otp, action: 'account_verification' });

            try {
                await sendOTPEmail(user.email, otp, 'account_verification');
                console.log("✅ OTP resent email sent");
            } catch (err) {
                console.log("❌ EMAIL ERROR:", err.message);
            }

            return res.status(403).json({
                message: 'Account not verified',
                needsVerification: true,
                email: user.email
            });
        }

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role)
        });

    } catch (error) {
        console.log("❌ SERVER ERROR:", error.message);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ================= VERIFY OTP =================
exports.verifyOTP = async (req, res) => {
    try {
        console.log("VERIFY BODY:", req.body); // Debug

        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP required' });
        }

        const validOTP = await OTP.findOne({
            email,
            otp,
            action: 'account_verification'
        });

        if (!validOTP) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const user = await User.findOneAndUpdate(
            { email },
            { isVerified: true },
            { new: true }
        );

        await OTP.deleteOne({ _id: validOTP._id });

        console.log("✅ OTP verified successfully");

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role)
        });

    } catch (error) {
        console.log("❌ SERVER ERROR:", error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};