function admin(req,res,next){
    const t = req.cookies.admin_session; // signedCookies এর বদলে সরাসরি cookies ব্যবহার করা নিরাপদ যদি signed কি না থাকে
    if(!t) return res.status(401).json({error:"Unauthorized"});
    const s = db.prepare("SELECT * FROM sessions WHERE token=? AND expires_at>?").get(t, Date.now());
    if(!s) return res.status(401).json({error:"Unauthorized"});
    next();
}

// Admin Login Route
app.post("/api/admin/login", (req, res) => {
    try {
        const { password } = req.body;
        const s = settingsData();
        let passHash = s.admin_password_hash;

        // যদি ডাটাবেজে পাসওয়ার্ডের হাশ না থাকে, তবে এনভায়রনমেন্ট ভেরিয়েবল চেক করবে অথবা ডিফল্ট পাসওয়ার্ড সেট করবে
        if (!passHash) {
            const envPass = process.env.ADMIN_PASSWORD || "admin123";
            passHash = bcrypt.hashSync(envPass, 10);
            db.prepare("INSERT INTO settings(key,value) VALUES('admin_password_hash',?) ON CONFLICT(key) DO UPDATE SET value=?").run(passHash, passHash);
        }

        const match = bcrypt.compareSync(password || "", passHash);
        if (!match) {
            return res.status(401).json({ error: "Invalid password" });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expires_at = Date.now() + 7 * 24 * 60 * 60 * 1000; // ৭ দিন মেয়াদ
        db.prepare("INSERT INTO sessions(token, expires_at) VALUES(?, ?)").run(token, expires_at);

        res.cookie("admin_session", token, {
            httpOnly: true,
            secure: false, // প্রোডাকশনে HTTPS হলে true করতে পারেন
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Admin Check Auth Route
app.get("/api/admin/me", admin, (req, res) => {
    res.json({ success: true });
});

// Admin Logout Route
app.post("/api/admin/logout", (req, res) => {
    const t = req.cookies.admin_session;
    if (t) {
        db.prepare("DELETE FROM sessions WHERE token=?").run(t);
    }
    res.clearCookie("admin_session");
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
