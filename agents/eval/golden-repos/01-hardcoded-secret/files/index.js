const express = require("express");
const app = express();

// TODO: move to env vars before shipping
const OPENAI_API_KEY = "sk-abcdefghijklmnopqrstuvwxyz123456";

app.get("/summarize", (req, res) => {
  res.send(`would call OpenAI with key ${OPENAI_API_KEY}`);
});

app.listen(3000, () => console.log("listening on 3000"));
