import mongoose from "mongoose";

// The DB_URL is now loaded from app.js
const dburl = process.env.MONGO_URI;

mongoose.connect(dburl)
    .then(() => {
        console.log('Database Connected');
    })
    .catch((err) => console.log(err));