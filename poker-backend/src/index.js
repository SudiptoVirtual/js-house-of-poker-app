const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
const adminPlayerRoutes = require("./routes/adminPlayerRoutes");
const adminTableRoutes = require("./routes/adminTableRoutes");

const adminTransactionRoutes = require("./routes/adminTransactionRoutes");
const adminLiveRoutes = require("./routes/adminLiveRoutes");

const { setIO } = require("./sockets/socketRegistry");
const { initAdminLiveSocket } = require("./sockets/adminLiveSocket");
const { initPlayerGameSocket } = require("./sockets/playerGameSocket");

//const adminHandHistoryRoutes = require("./routes/adminHandHistoryRoutes");
//const adminSettingsRoutes = require("./routes/adminSettingsRoutes");





dotenv.config();
connectDB();

const parseAllowedOrigins = (origins = "") =>
  origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const localDevelopmentOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8081",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8081",
];

const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = new Set([
  ...parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  ...(!isProduction ? localDevelopmentOrigins : []),
]);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
};

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: corsOptions,
});

setIO(io);
initAdminLiveSocket(io);
initPlayerGameSocket(io);

app.use(cors(corsOptions));
app.use(express.json());


app.get("/", (req, res) => {
  res.send("Poker backend is running");
});

/*
|--------------------------------------------------------------------------
| App User Routes
|--------------------------------------------------------------------------
*/
app.use("/api/auth", authRoutes);

/*
|--------------------------------------------------------------------------
| Admin Routes
|--------------------------------------------------------------------------
*/
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/players", adminPlayerRoutes);
app.use("/api/admin/tables", adminTableRoutes);

app.use("/api/admin/transactions", adminTransactionRoutes);
app.use("/api/admin/live", adminLiveRoutes);
//app.use("/api/admin/hands", adminHandHistoryRoutes);
//app.use("/api/admin/settings", adminSettingsRoutes);

/*
|--------------------------------------------------------------------------
| Test / Basic User Routes
|--------------------------------------------------------------------------
*/
app.use("/api/users", userRoutes);
/*
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});*/

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
