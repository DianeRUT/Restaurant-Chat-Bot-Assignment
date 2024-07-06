import { Router } from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const route = Router();

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

route.get("/", (req, res) => {
  if (req.session.username) {
    res.redirect("/chat");
    return;
  }
  res.sendFile(join(__dirname, "..", "public", "index.html"));
});

route.post("/", (req, res) => {
  req.session.username = req.body.username;
  res.redirect("/chat");
});

route.get("/chat", (req, res) => {
  if (req.session.username) {
    res.cookie('username', req.session.username);
    res.sendFile(join(__dirname, "..", "public", "chat.html"));
    return;
  }
  res.redirect("/");
});

export default route;


// import express from "express";

// const router = express.Router();

// router.get("/", (req, res) => {
// 	if (!req.session.userId) {
// 		return res.status(401).send("Unauthorized");
// 	}
// 	// Proceed with handling the request
// });

// export default router;
