// server/routes/contact.js

const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

router.post("/", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ success: false, error: "All fields required" });
  }

  try {
    // Transporter setup (use Gmail App Password, not your main password)
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER, // e.g. youraccount@gmail.com
        pass: process.env.GMAIL_PASS, // Gmail App Password
      },
    });

    await transporter.sendMail({
      from: `"Sublynk Contact" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER, // your Gmail inbox
      subject: `📩 New Contact Message from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Message:</b><br/>${message}</p>
      `,
    });

    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ success: false, error: "Email failed to send" });
  }
});

module.exports = router;
