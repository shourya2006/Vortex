const mongoose = require("mongoose");
require("dotenv").config();
const User = require("../models/User.model");

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    const indexes = await User.collection.indexes();
    console.log(
      "Current indexes:",
      indexes.map((i) => i.name),
    );

    try {
      await User.collection.dropIndex("googleId_1");
      console.log("Dropped googleId_1 index");
    } catch (e) {
      console.log("Could not drop googleId_1 (may not exist):", e.message);
    }

    console.log("Syncing indexes...");
    await User.syncIndexes();
    console.log(
      "Indexes synced successfully (googleId should be sparse now)",
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

main();
