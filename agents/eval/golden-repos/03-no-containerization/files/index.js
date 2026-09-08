const express = require("express");
const app = express();

app.get("/orders", (req, res) => {
  res.json([{ id: 1, item: "widget" }]);
});

app.listen(process.env.PORT || 3000);
