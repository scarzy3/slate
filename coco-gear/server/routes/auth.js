import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { validate, loginSchema } from '../utils/validation.js';

const prisma = new PrismaClient();
const router = Router();

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

// POST /login - verify PIN and return JWT + user data
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
        title: user.title,
        role: user.role,
        deptId: user.deptId,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /me - return current user profile (requires auth)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user.id,
      name: user.name,
      title: user.title,
      role: user.role,
      deptId: user.deptId,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /me - update own profile (name and title only)
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { name, title } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (title !== undefined) data.title = title;

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
      title: user.title,
      role: user.role,
      deptId: user.deptId,
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
