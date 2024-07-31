/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
import {
  getFirestore,
  Timestamp} from "firebase-admin/firestore";
import {
  removeUndefinedProperties,
} from "../firestore.js";
import {logger} from "firebase-functions/v2";
