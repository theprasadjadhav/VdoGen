import { Router } from "express";
import { sendError } from "../functions";
import { cookieOptions, JWT_SECRET, logger, prismaClient } from "../../util/config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { authMiddleware } from "../middlewares";
import { authLimiter } from "../rateLimiters";

const authRouter = Router();

authRouter.post("/signin", authLimiter, async (req, res) => {
    const { email, password } = req.body

    try {
        if (!email || !password) {
            logger.info({
                msg: "Authentication attempt with missing email or password",
                method: req.method,
                url: req.originalUrl,
            });
            return sendError(res, 400, "Bad Request: Missing email or password");
        }

        const usersIdentities = await prismaClient.userIdentities.findMany({
            where: {
                email: email
            },
            include: {
                user: {
                    omit: {
                        createdAt: true,
                        updatedAt: true
                    }
                }
            }
        })

        if (usersIdentities.length === 0) {
            logger.info({
                msg: "Authentication failed: No account found with this email",
                email,
                method: req.method,
                url: req.originalUrl
            });
            return sendError(res, 401, "No account found with this email address. Please check your email or sign up.");
        }
        const userIdentity = usersIdentities.find(identities => identities.provider === "Email")

        if (!userIdentity) {
            logger.info({
                msg: "Authentication failed: No user identity found with provider 'Email'",
                email,
                method: req.method,
                url: req.originalUrl
            });
            return sendError(res, 401, "An account with this email exists, but was registered using a different provider. Please sign in using the correct provider or use a different email.");
        }


        const match = await bcrypt.compare(password, userIdentity.password!);

        if (!match) {
            logger.info({ msg: "Authentication failed: Password mismatch", email });
            return sendError(res, 401, "Authentication failed: Invalid email or password");
        }

        const user = userIdentity.user;
        const token = jwt.sign({ data: { ...user } }, JWT_SECRET, { expiresIn: "7d" });
        res.cookie("token", token, cookieOptions);

        logger.info({
            msg: "Authentication successful",
            userId: user?.id,
            email,
            method: req.method,
            url: req.originalUrl
        });

        res.status(200).json({ success: true, message: "Authentication successful", user });

    } catch (error) {
        logger.error({
            msg: "Authentication error occurred during sign in",
            route: req.originalUrl,
            email,
            method: req.method,
            error: error instanceof Error ? error.message : error
        });
        sendError(res, 500, "Authentication error occurred during sign in");
        return;
    }
})

authRouter.post("/signup", authLimiter, async (req, res) => {
    const { name, email, password, confirmPassword } = req.body

    try {

        if (!name || !email || !password || !confirmPassword || password != confirmPassword) {
            logger.info({
                msg: "Signup failed: Invalid input for signup",
                name,
                email,
                method: req.method,
                url: req.originalUrl
            });
            return sendError(res, 400, "Invalid input for signup");
        }

        logger.info({
            msg: "Signup attempt",
            name,
            email,
            method: req.method,
            url: req.originalUrl
        });

        const usersIdentities = await prismaClient.userIdentities.findMany({
            where: {
                email: email
            },
            include: {
                user: true
            }
        })

        if (usersIdentities.length === 0) {
            logger.info({
                msg: "Account does not exist for this email. Proceeding with creating new user.",
                email,
                method: req.method,
                url: req.originalUrl
            });

            const hash = await bcrypt.hash(password, 12);
            const user = await prismaClient.user.create({
                data: {
                    email,
                    name,
                    userIdentities: {
                        create: {
                            email: email,
                            password: hash,
                            provider: "Email",
                            providerSub: email
                        }
                    }
                },
                omit: {
                    createdAt: true,
                    updatedAt: true
                }
            })
            logger.info({
                msg: "Signup successful: Account created",
                userId: user.id,
                email,
                method: req.method,
                url: req.originalUrl
            });
            const token = jwt.sign({
                data: {
                    ...user
                }
            }, JWT_SECRET, { expiresIn: "7d" })

            res.cookie("token", token, cookieOptions)

            res.status(200).json({
                success: true,
                message: "Account created successfully",
                user
            })
        } else {
            logger.info({
                msg: "Signup failed: Account already exists with this email",
                email,
                method: req.method,
                url: req.originalUrl
            });
            return sendError(res, 409, "An account already exists with this email address. Please sign in instead.");
        }
    } catch (error) {
        logger.error({
            msg: "Authentication error occurred during sign in",
            route: req.originalUrl,
            email,
            method: req.method,
            error: error instanceof Error ? error.message : error
        });
        sendError(res, 500, "Authentication error occurred during sign in, please try again");
        return;
    }
})

authRouter.post("/google", authLimiter, async (req, res) => {

    const { token } = req.body;

    try {
        logger.info({
            msg: "Google authentication attempt started",
            method: req.method,
            url: req.originalUrl
        });

        const client = new OAuth2Client(process.env.GOOGLE_AUTH_CLIENT_ID);

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_AUTH_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload) {
            logger.info({
                msg: "Google authentication failed: Invalid token payload",
                method: req.method,
                url: req.originalUrl
            });
            return sendError(res, 400, "Invalid Google token payload");
        }

        const userIdentity = await prismaClient.userIdentities.findFirst({
            where: {
                providerSub: payload?.sub,
                provider: "GOOGLE"
            },
            include: {
                user: {
                    omit: {
                        createdAt: true,
                        updatedAt: true
                    }
                }
            }
        })

        if (!userIdentity) {
            logger.info({
                msg: "Google authentication: No user identity found, creating new Google user.",
                googleSub: payload.sub,
                email: payload.email,
                method: req.method,
                url: req.originalUrl
            });
            const user = await prismaClient.user.create({
                data: {
                    email: payload.email,
                    name: payload.name ?? "user",
                    avatarUrl: payload.picture ?? null,
                    userIdentities: {
                        create: {
                            email: payload.email ?? "undefined",
                            provider: "GOOGLE",
                            providerSub: payload.sub
                        }
                    }
                },
                omit: {
                    createdAt: true,
                    updatedAt: true
                }
            })

            logger.info({
                msg: "Google authentication successful: Account created and signed in",
                userId: user.id,
                email: user.email,
                method: req.method,
                url: req.originalUrl
            });

            const jwtToken = jwt.sign({
                data: {
                    ...user
                }
            }, JWT_SECRET, { expiresIn: "7d" })

            res.cookie("token", jwtToken, cookieOptions);

            res.status(200).json({ success: true, message: "Account created successfully", user });
        } else {
            logger.info({
                msg: "Google authentication successful: Existing user signed in",
                userId: userIdentity.user.id,
                email: userIdentity.user.email,
                method: req.method,
                url: req.originalUrl
            });
            const jwtToken = jwt.sign({
                data: {
                    ...userIdentity.user
                }
            }, JWT_SECRET, { expiresIn: "7d" })

            res.cookie("token", jwtToken, cookieOptions);
            res.status(200).json({ success: true, message: "Authentication successful", user: userIdentity.user });
        }

    } catch (err) {
        logger.error({
            msg: "Google authentication error",
            method: req.method,
            url: req.originalUrl,
            error: err instanceof Error ? err.message : err
        });
        sendError(res, 401, "Invalid Google token")
    }
})

authRouter.get("/identities", authMiddleware, async (req, res) => {
    const userId = req.user?.id;
    try {
        logger.info({
            msg: "Fetching user identities",
            userId,
            method: req.method,
            url: req.originalUrl
        });
        const identities = await prismaClient.userIdentities.findMany({
            where: { userId },
            select: {
                provider: true,
                email: true,
            }
        });

        res.status(200).json({
            success: true,
            message: "User identities fetched successfully",
            identities
        });
    } catch (err) {
        logger.error({
            msg: "Failed to fetch user identities",
            userId,
            method: req.method,
            url: req.originalUrl,
            error: err instanceof Error ? err.message : err
        });
        sendError(res, 500, "Failed to fetch identities");
    }
})

authRouter.post("/change-password", authLimiter, authMiddleware, async (req, res) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!userId) {
        logger.info({
            msg: "Password change failed: Unauthorized",
            method: req.method,
            url: req.originalUrl
        });
        return sendError(res, 401, "Unauthorized");
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
        logger.info({
            msg: "Password change failed: Missing fields",
            userId,
            method: req.method,
            url: req.originalUrl
        });
        return sendError(res, 400, "All fields are required");
    }

    if (newPassword !== confirmPassword) {
        logger.info({
            msg: "Password change failed: Passwords do not match",
            userId,
            method: req.method,
            url: req.originalUrl
        });
        return sendError(res, 400, "New passwords do not match");
    }

    try {
        logger.info({
            msg: "Password change attempt",
            userId,
            method: req.method,
            url: req.originalUrl
        });

        const userIdentity = await prismaClient.userIdentities.findMany({
            where: {
                userId
            }
        });
        if (!userIdentity) {
            logger.info({
                msg: "Password change failed: No userIdentity found (not email/password user perhaps)",
                userId,
                method: req.method,
                url: req.originalUrl
            });
            return sendError(res, 400, "Password change is only available for email/password users.");
        }
        const foundUser = userIdentity.find(user => user.provider === "Email")

        if (!foundUser) {
            logger.info({
                msg: "Password change failed: Email provider not found for user",
                userId,
                method: req.method,
                url: req.originalUrl
            });
            return sendError(res, 404, "User not found");
        }

        const valid = await bcrypt.compare(currentPassword, foundUser.password!);

        if (!valid) {
            logger.info({
                msg: "Password change failed: Incorrect current password",
                userId,
                method: req.method,
                url: req.originalUrl
            });
            return sendError(res, 400, "Current password is incorrect");
        }

        if (currentPassword === newPassword) {
            logger.info({
                msg: "Password change failed: New password same as current password",
                userId,
                method: req.method,
                url: req.originalUrl
            });
            return sendError(res, 400, "New password cannot be the same as current password");
        }

        const newHash = await bcrypt.hash(newPassword, 12);

        await prismaClient.userIdentities.update({
            where: { id: foundUser.id },
            data: { password: newHash }
        });

        logger.info({
            msg: "Password changed successfully",
            userId,
            method: req.method,
            url: req.originalUrl
        });

        res.status(200).json({ success: true, message: "Password changed successfully" });
    } catch (err) {
        logger.error({
            msg: "Failed to change password",
            userId,
            method: req.method,
            url: req.originalUrl,
            error: err instanceof Error ? err.message : err
        });
        sendError(res, 500, "Failed to change password");
    }
})

authRouter.get("/signout", (req, res) => {
    logger.info({
        msg: "User signed out (clear cookie)",
        method: req.method,
        url: req.originalUrl
    });
    res.clearCookie("token");
    res.status(200).json({ success: true, message: "Logged out successfully" });
})

authRouter.get("/me", authMiddleware, async (req, res) => {

    try {
        logger.info({
            msg: "Fetching current user (/me endpoint)",
            userId: req.user?.id,
            method: req.method,
            url: req.originalUrl
        });

        const user = await prismaClient.user.findUnique({
            where: {
                id: req.user?.id
            },
            omit: {
                createdAt: true,
                updatedAt: true
            }
        });
        res.status(200).json({
            success: true,
            message: "User data fetched successfully",
            user: user
        });
    } catch (err) {
        logger.error({
            msg: "Failed to fetch current user (/me endpoint)",
            userId: req.user?.id,
            method: req.method,
            url: req.originalUrl,
            error: err instanceof Error ? err.message : err
        });
        sendError(res, 500, "Failed to fetch user data");
    }
})

export default authRouter;
