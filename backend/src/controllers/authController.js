import prisma from "../lib/prisma.js";

/**
 * Development login endpoint
 * POST /api/dev/login
 * Body: { userId: "user-attendee-1" }
 */
export async function devLogin(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: userId"
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        attendees: {
          include: { event: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User '${userId}' not found in development seed`
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        rollNumber: user.rollNumber,
        role: user.role
      },
      token: user.id
    });
  } catch (err) {
    console.error("devLogin error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error during dev login"
    });
  }
}

/**
 * List all development users for quick switching
 * GET /api/dev/users
 */
export async function listDevUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { role: "asc" }
    });

    return res.status(200).json({
      success: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        rollNumber: u.rollNumber,
        role: u.role
      }))
    });
  } catch (err) {
    console.error("listDevUsers error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
