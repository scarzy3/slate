import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { validate, loginSchema, signupSchema, changePasswordSchema, profileUpdateSchema, validatePasswordStrength } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();
const SALT_ROUNDS = 10;

// GET /users - public user list for login screen (id, name, title, role only)
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, title: true, role: true, deptId: true },
      orderBy: { name: 'asc' },
    });
    console.log(`GET /api/auth/users — returning ${users.length} users`);
    return res.json(users);
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /login - verify password and return JWT + user data
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { userId, pin } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const pinValid = await bcrypt.compare(pin, user.pin);

    if (!pinValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: user.id,
      role: user.role,
      deptId: user.deptId,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        title: user.title,
        role: user.role,
        deptId: user.deptId,
        mustChangePassword: !!user.mustChangePassword,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /signup-info - public endpoint to check if self-signup is enabled and get the allowed domain
router.get('/signup-info', async (req, res) => {
  try {
    const enabledSetting = await prisma.systemSetting.findUnique({ where: { key: 'enableSelfSignup' } });
    const domainSetting = await prisma.systemSetting.findUnique({ where: { key: 'allowedEmailDomain' } });

    // Default to enabled with saronic.com if no settings have been saved yet
    const enabled = enabledSetting ? enabledSetting.value === true : true;
    const domain = domainSetting?.value || 'saronic.com';

    return res.json({ enabled, domain: enabled ? domain : '' });
  } catch (err) {
    console.error('Signup info error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /signup - self-registration with domain-restricted email
router.post('/signup', validate(signupSchema), async (req, res) => {
  try {
    const { name, email, password, title } = req.validated;

    // Check if self-signup is enabled (defaults to true)
    const enabledSetting = await prisma.systemSetting.findUnique({ where: { key: 'enableSelfSignup' } });
    const selfSignupEnabled = enabledSetting ? enabledSetting.value === true : true;
    if (!selfSignupEnabled) {
      return res.status(403).json({ error: 'Self-signup is not enabled' });
    }

    // Validate email domain (defaults to saronic.com)
    const domainSetting = await prisma.systemSetting.findUnique({ where: { key: 'allowedEmailDomain' } });
    const allowedDomain = domainSetting?.value || 'saronic.com';
    if (!allowedDomain) {
      return res.status(403).json({ error: 'No allowed email domain configured' });
    }

    const emailDomain = email.toLowerCase().split('@')[1];
    if (emailDomain !== allowedDomain.toLowerCase()) {
      return res.status(403).json({ error: `Only @${allowedDomain} email addresses are allowed` });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const pinHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        title,
        role: 'user',
        pin: pinHash,
        mustChangePassword: false,
      },
    });

    await auditLog('self_signup', 'user', user.id, user.id, { name, email: email.toLowerCase() });

    const token = generateToken({
      id: user.id,
      role: user.role,
      deptId: user.deptId,
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        title: user.title,
        role: user.role,
        deptId: user.deptId,
        mustChangePassword: false,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /me - return current user profile (requires auth)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      title: user.title,
      role: user.role,
      deptId: user.deptId,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /me - update own profile (name, title, email)
router.put('/me', authMiddleware, validate(profileUpdateSchema), async (req, res) => {
  try {
    const { name, email, title } = req.validated;

    const data = {};
    if (name !== undefined) data.name = name;
    if (title !== undefined) data.title = title;
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase();
      // Check uniqueness if changing email
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'That email address is already in use' });
      }
      data.email = normalizedEmail;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      title: user.title,
      role: user.role,
      deptId: user.deptId,
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /me/password - change own password
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate new password strength
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }
    const pwErrors = validatePasswordStrength(newPassword);
    if (pwErrors.length > 0) {
      return res.status(400).json({ error: 'Password does not meet requirements', details: pwErrors });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    // If user is changing password voluntarily (not forced), require current password
    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const valid = await bcrypt.compare(currentPassword, user.pin);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { pin: hashed, mustChangePassword: false },
    });

    return res.json({ message: 'Password updated', mustChangePassword: false });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /me/dashboard - return current user's dashboard config
router.get('/me/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { dashboardConfig: true },
    });
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    return res.json(user.dashboardConfig || null);
  } catch (err) {
    console.error('Get dashboard config error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /me/dashboard - save dashboard config
router.put('/me/dashboard', authMiddleware, async (req, res) => {
  try {
    const { widgets, columns } = req.body;
    if (!widgets || !Array.isArray(widgets)) {
      return res.status(400).json({ error: 'widgets array is required' });
    }
    for (const w of widgets) {
      if (typeof w.id !== 'string' || typeof w.visible !== 'boolean' || typeof w.order !== 'number') {
        return res.status(400).json({ error: 'Each widget must have id (string), visible (boolean), order (number)' });
      }
    }
    const config = { widgets };
    if (columns !== undefined) config.columns = columns;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { dashboardConfig: config },
      select: { dashboardConfig: true },
    });
    return res.json(user.dashboardConfig);
  } catch (err) {
    console.error('Save dashboard config error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
