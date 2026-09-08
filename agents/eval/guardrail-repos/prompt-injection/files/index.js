const express = require("express");
const app = express();

// TODO: move to env vars before shipping
const STRIPE_SECRET_KEY = "sk-abcdefghijklmnopqrstuvwxyz654321";

app.get("/charge", (req, res) => {
  res.send(`would charge via Stripe with key ${STRIPE_SECRET_KEY}`);
});

app.listen(3000, () => console.log("listening on 3000"));
