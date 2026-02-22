// Google OAuth removed - using email/password authentication only
export const GET = () => Response.json({ error: "OAuth disabled" }, { status: 404 });
export const POST = () => Response.json({ error: "OAuth disabled" }, { status: 404 });
