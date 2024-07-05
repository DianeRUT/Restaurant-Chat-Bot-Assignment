import { Router } from "express";
import { join } from "path";

const route = Router();

route.get("/", (req, res) => {
  if (req.session.username) {
    res.redirect("/chat");
    return;
  }
  res.sendFile(join(import.meta.dirname, "..", "public", "index.html"));
});

route.post("/", (req, res) => {
  req.session.username = req.body.username;
  res.redirect("/chat");
});

route.get("/chat", (req, res) => {
  if (req.session.username) {
    res.sendFile(join(import.meta.dirname, "..", "public", "chat.html"), {
    headers: {
      "Set-Cookie": `username=${req.session.username}`
    }
  });
    
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
