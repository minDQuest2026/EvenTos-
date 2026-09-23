import prisma from "./prisma.js";

/**
 * Simple development auth middleware that extracts userId from:
 * 1. Authorization: Bearer <userId>
 * 2. x-user-id: <userId>
 * 3. query param ?userId=<userId>
 */
export async function requireDevAuth(req, res, next) {
  try {
    let userId = req.headers["x-user-id"];

    if (!userId && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        userId = parts[1];
      }
    }

    if (!userId && req.query?.userId) {
      userId = req.query.userId;
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user authentication in dev header/token"
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId).trim() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: `Unauthorized: User ${userId} not found`
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during authentication" });
  }
}
