"use strict";
import dotenv from "dotenv";
process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
dotenv.config({path: ".env.local"}); // because firebase-functions-test doesn't work with conf.
